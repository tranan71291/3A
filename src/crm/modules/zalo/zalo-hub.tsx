'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { BellRing, ChevronLeft, Info, Link2, MapPin, PenLine, Phone, Plus, Search, Send, Sparkles, StickyNote, UserPlus, X, Zap } from 'lucide-react';
import { useOutsideClose } from '../../app/header';
import { Avatar } from '../../components/controls';
import { Chip, EmptyState, Field, SideSheet, useSticky } from '../../components/ui';
import { aiErrText, boqTotal, btnGhost, btnPrimary, btnSm, canSeeConv, compact, fillVars, fmtN, fold, givenName, inputBase, inputCls, JOB_STAGE, LEAD_STATUS, stickyStore, uid, useApp, ZLINK_LABEL, ZNS_SOURCES, ZSTATUS, zTime } from '../../lib/core';
import type { Customer, Job, LinkHit, User, ZaloConv, ZaloConvStatus, ZaloLink, ZaloLinkKind, ZaloMsg, ZFilter } from '../../lib/types';
import { cn } from '../../lib/utils';
import { jobStageOf } from '../../lib/workshop';
import { apiPost, convCustomer, kbFor, suggestLinks, useAi, useServerStatus } from '../ai/ai-core';
import { AiWriterSheet } from '../ai/copilot-plus';

export function ZaloHubPage() {
  const { me } = useApp();
  return me ? <ZaloHubInner me={me} /> : null;
}

/** Gợi ý trả lời cục bộ (khi chưa kết nối AI): theo ý định trong tin nhắn gần nhất của khách */
export function localReply(lastIn: string, name: string, staff: string, company: string): string {
  const t = fold(lastIn);
  const ten = givenName(name) ? `${/^(co|chu|bac|ong|ba)\b/.test(fold(name)) ? fold(name).split(' ')[0].replace('co', 'cô').replace('chu', 'chú').replace('bac', 'bác') : 'anh/chị'} ${name.split(' ').slice(-1)[0]}` : 'anh/chị';
  if (/gia|bao gia|bao nhieu|chi phi/.test(t)) return `Dạ em chào ${ten}, em là ${staff} bên ${company}. Em đã nhận yêu cầu báo giá, em gửi bảng giá chi tiết cho ${ten} trong hôm nay ạ. ${ten} cho em xin thêm kích thước / số lượng dự kiến để em tính chính xác nhé.`;
  if (/lich|hen|khao sat|qua nha|den nha|lap dat/.test(t)) return `Dạ em chào ${ten}, bên em sắp xếp kỹ thuật qua khảo sát được. ${ten} cho em xin khung giờ thuận tiện và địa chỉ chính xác, em xác nhận lịch ngay ạ.`;
  if (/bao hanh|hong|loi|sua|bi/.test(t)) return `Dạ em rất xin lỗi ${ten} vì sự bất tiện. ${ten} gửi giúp em ảnh hiện trạng, em chuyển kỹ thuật kiểm tra và hẹn lịch xử lý sớm nhất ạ.`;
  if (/ton kho|con hang|giao hang|bao gio/.test(t)) return `Dạ em kiểm tra tồn kho và lịch giao rồi báo lại ${ten} trong 15 phút ạ.`;
  return `Dạ em cảm ơn ${ten} đã nhắn tin cho ${company}. Em là ${staff}, em hỗ trợ ${ten} ngay ạ.`;
}

export function ZaloHubInner({ me }: { me: User }) {
  const app = useApp();
  const { zaloConvs, setZaloConvs, zaloMsgs, setZaloMsgs, hubCfg, users, userName, customers, leads, jobs, quotes, pos, company, notify, audit, canDo, kb, now } = app;
  const [srv] = useServerStatus();
  const ai = useAi('chat');
  const [curId, setCurId] = useSticky<string | null>('ZaloHub.cur', null);
  const [filter, setFilter] = useSticky<ZFilter>('ZaloHub.f', 'ALL');
  const [q, setQ] = useState('');
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [ctxOpen, setCtxOpen] = useState(false);
  const [zns, setZns] = useState(false);
  const [writer, setWriter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const qrRef = useOutsideClose(qrOpen, () => setQrOpen(false));
  const endRef = useRef<HTMLDivElement>(null);
  const live = srv.zalo.oa;
  const t = now ?? Date.now();

  const visible = zaloConvs.filter((c) => canSeeConv(c, me, hubCfg));
  const counts = { ALL: visible.filter((c) => c.status !== 'CLOSED').length, UNREAD: visible.filter((c) => (c.unread ?? 0) > 0).length, MINE: visible.filter((c) => c.assignee === me.id && c.status !== 'CLOSED').length, UNASSIGNED: visible.filter((c) => !c.assignee && c.status !== 'CLOSED').length, CLOSED: visible.filter((c) => c.status === 'CLOSED').length };
  const ft = fold(q.trim());
  const list = visible
    .filter((c) => (filter === 'ALL' ? c.status !== 'CLOSED' : filter === 'UNREAD' ? (c.unread ?? 0) > 0 : filter === 'MINE' ? c.assignee === me.id && c.status !== 'CLOSED' : filter === 'UNASSIGNED' ? !c.assignee && c.status !== 'CLOSED' : c.status === 'CLOSED'))
    .filter((c) => !ft || fold(`${c.displayName} ${c.phone ?? ''} ${c.address ?? ''} ${c.lastText ?? ''} ${(c.tags ?? []).join(' ')} ${(c.links ?? []).map((l) => linkLabel(l)).join(' ')}`).includes(ft))
    .sort((a, b) => b.lastAt - a.lastAt);
  const cur = visible.find((c) => c.id === curId) ?? null;
  const msgs = cur ? zaloMsgs.filter((m) => m.convId === cur.id).sort((a, b) => a.at - b.at) : [];
  const cust = cur ? convCustomer(cur, app) : undefined;
  const hits = cur ? suggestLinks(cur, msgs, app) : [];

  function linkLabel(l: ZaloLink): string {
    if (l.kind === 'customer') return customers.find((c) => c.id === l.id)?.name ?? l.id;
    if (l.kind === 'lead') { const x = leads.find((v) => v.id === l.id); return x ? `${x.code} ${x.company}` : l.id; }
    if (l.kind === 'job') { const x = jobs.find((v) => v.id === l.id); return x ? `${x.code} ${x.title}` : l.id; }
    if (l.kind === 'quote') return quotes.find((v) => v.id === l.id)?.code ?? l.id;
    return pos.find((v) => v.id === l.id)?.code ?? l.id;
  }
  const patch = (id: string, fn: (c: ZaloConv) => ZaloConv) => setZaloConvs((p) => p.map((c) => (c.id === id ? fn(c) : c)));
  const addLink = (h: { kind: ZaloLinkKind; id: string }, auto = false) => {
    if (!cur) return;
    patch(cur.id, (c) => ({ ...c, links: [...(c.links ?? []).filter((l) => !(l.kind === h.kind && l.id === h.id)), { kind: h.kind, id: h.id, auto }] }));
    audit('ZALO_LINK', `${cur.displayName} → ${ZLINK_LABEL[h.kind]} ${linkLabel({ kind: h.kind, id: h.id })}${auto ? ' (tự động)' : ''}`);
  };

  // Mở hội thoại: đánh dấu đã đọc, tự liên kết khi khớp chắc chắn (SĐT / mã / tên + địa chỉ)
  useEffect(() => {
    if (!cur) return;
    if (cur.unread) patch(cur.id, (c) => ({ ...c, unread: 0 }));
    if (hubCfg.zalo.autoLink && !(cur.links ?? []).length && hits[0] && hits[0].score >= 75) {
      addLink(hits[0], true);
      notify(`Đã tự liên kết hội thoại với ${ZLINK_LABEL[hits[0].kind].toLowerCase()} ${hits[0].label} (${hits[0].why})`, 'teal');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.id, cur?.unread]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [cur?.id, msgs.length]);

  const vars = (c: ZaloConv) => ({ ten: c.displayName, nhanvien: me.name, congty: company.shortName || company.appName, ma: cust?.code ?? '' });
  const send = async () => {
    const v = text.trim();
    if (!cur || !v) return;
    setText('');
    const id = uid('zm');
    if (mode === 'note') {
      setZaloMsgs((p) => [...p, { id, convId: cur.id, dir: 'NOTE', kind: 'text', text: v, at: Date.now(), by: me.id }]);
      return;
    }
    const realSend = live && !cur.demo;
    const msg: ZaloMsg = { id, convId: cur.id, dir: 'OUT', kind: 'text', text: v, at: Date.now(), by: me.id, status: realSend ? 'SENDING' : 'DEMO' };
    setZaloMsgs((p) => [...p, msg]);
    patch(cur.id, (c) => ({ ...c, lastAt: msg.at, lastText: v, assignee: c.assignee ?? me.id, firstReplyAt: c.firstReplyAt ?? msg.at, status: c.status === 'CLOSED' ? 'OPEN' : c.status }));
    if (!realSend) return;
    const r = await apiPost<{ msgId?: string }>('/api/zalo/send', { tenant: app.org.id, userId: cur.zaloUserId, text: v });
    setZaloMsgs((p) => p.map((m) => (m.id === id ? { ...m, status: r.ok ? 'SENT' : 'FAILED', error: r.ok ? undefined : aiErrText(r.error), zaloMsgId: r.msgId } : m)));
    if (!r.ok) notify(`Gửi Zalo thất bại: ${aiErrText(r.error)}`, 'red');
  };
  const suggest = async () => {
    if (!cur) return;
    const lastIn = [...msgs].reverse().find((m) => m.dir === 'IN')?.text ?? '';
    setBusy(true);
    if (ai.available) {
      const hist = msgs.filter((m) => m.dir === 'IN' || m.dir === 'OUT').slice(-12).map((m) => `${m.dir === 'IN' ? 'Khách' : 'Nhân viên'}: ${m.text}`).join('\n');
      const ctx = [cust && `Khách hàng: ${cust.name} (${cust.code}), hạng ${cust.tier}, doanh số năm nay ${compact(cust.ytdRevenue)}, công nợ ${compact(cust.debt)}.`,
        ...(cur.links ?? []).map((l) => `${ZLINK_LABEL[l.kind]}: ${linkLabel(l)}`), ...kbFor(kb, lastIn).map((k) => `Chính sách "${k.title}": ${k.body}`)].filter(Boolean).join('\n');
      const r = await ai.ask({ system: 'Bạn soạn câu trả lời Zalo cho nhân viên chăm sóc khách hàng: lịch sự, xưng "em", gọi khách theo cách khách được gọi trong hội thoại, tối đa 3 câu, không hứa điều không có trong dữ liệu. Chỉ trả về nội dung tin nhắn.', prompt: `Hội thoại:\n${hist}\n\nNgữ cảnh:\n${ctx}\n\nNhân viên: ${me.name}, công ty ${company.shortName || company.appName}. Soạn câu trả lời tiếp theo.`, maxTokens: 400 });
      setBusy(false);
      if (r.ok) { setText(r.text); setMode('reply'); return; }
      notify(`AI chưa trả lời được (${r.error}), dùng gợi ý mẫu`, 'orange');
    }
    setBusy(false);
    setText(localReply(lastIn, cur.displayName, me.name, company.shortName || company.appName));
    setMode('reply');
  };

  const waitMin = (c: ZaloConv) => { const lastIn = zaloMsgs.filter((m) => m.convId === c.id && m.dir === 'IN').reduce((a, m) => Math.max(a, m.at), 0); const lastOut = zaloMsgs.filter((m) => m.convId === c.id && m.dir === 'OUT').reduce((a, m) => Math.max(a, m.at), 0); return lastIn > lastOut ? Math.round((t - lastIn) / 60000) : 0; };
  const related = cust ? {
    jobs: jobs.filter((j) => j.customerId === cust.id || (cur?.links ?? []).some((l) => l.kind === 'job' && l.id === j.id)),
    leads: leads.filter((l) => l.customerId === cust.id || (cur?.links ?? []).some((x) => x.kind === 'lead' && x.id === l.id)),
  } : { jobs: jobs.filter((j) => (cur?.links ?? []).some((l) => l.kind === 'job' && l.id === j.id)), leads: leads.filter((l) => (cur?.links ?? []).some((x) => x.kind === 'lead' && x.id === l.id)) };
  const custQuotes = quotes.filter((x) => (cur?.links ?? []).some((l) => l.kind === 'quote' && l.id === x.id) || related.leads.some((l) => l.id === x.leadId)).slice(0, 5);

  const [linkQ, setLinkQ] = useState('');
  const lq = fold(linkQ.trim());
  const linkFound: LinkHit[] = lq.length < 2 ? [] : [
    ...customers.filter((c) => fold(`${c.name} ${c.code} ${c.contactPhone} ${c.address}`).includes(lq)).slice(0, 4).map((c) => ({ kind: 'customer' as const, id: c.id, label: c.name, sub: c.code, score: 0, why: '' })),
    ...jobs.filter((j) => fold(`${j.code} ${j.title} ${j.siteAddress}`).includes(lq)).slice(0, 4).map((j) => ({ kind: 'job' as const, id: j.id, label: j.title, sub: j.code, score: 0, why: '' })),
    ...leads.filter((l) => fold(`${l.code} ${l.company}`).includes(lq)).slice(0, 4).map((l) => ({ kind: 'lead' as const, id: l.id, label: l.company, sub: l.code, score: 0, why: '' })),
  ];

  const FTABS: [ZFilter, string][] = [['ALL', 'Đang mở'], ['UNREAD', 'Chưa đọc'], ['MINE', 'Của tôi'], ['UNASSIGNED', 'Chưa nhận'], ['CLOSED', 'Đã xong']];
  const canAssign = canDo('zalo.assign');
  const canReply = canDo('zalo.reply');
  const section = (title: string, children: ReactNode, action?: ReactNode) => (
    <section className="border-b border-[rgb(var(--line))] px-4 py-3.5">
      <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-[11px] font-semibold text-[rgb(var(--muted))]">{title}</h3>{action}</div>
      {children}
    </section>
  );

  return (
    <div className="glass-card -mx-3 flex h-[calc(100vh-7.5rem)] min-h-[560px] overflow-hidden rounded-lg sm:mx-0">
      {/* ---------- Cột 1: danh sách hội thoại ---------- */}
      <aside className={cn('flex w-full shrink-0 flex-col border-r border-[rgb(var(--line))] md:w-[320px]', cur && 'max-md:hidden')} aria-label="Danh sách hội thoại">
        <div className="border-b border-[rgb(var(--line))] px-4 pb-3 pt-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0068FF] text-xs font-semibold text-white" aria-hidden>Zalo</span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-base font-semibold">{hubCfg.zalo.oaName || 'Zalo Official Account'}</h2>
              <p className="flex items-center gap-1.5 text-[11px] text-[rgb(var(--muted))]"><span className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-[rgb(var(--success))]' : 'bg-[#F59E0B]')} aria-hidden />{live ? 'Đã kết nối OA' : 'Chế độ mô phỏng'}{srv.zalo.webhook ? ' · nhận tin tự động' : ''}</p>
            </div>
          </div>
          <div className="relative mt-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--faint))]" aria-hidden /><input className={cn(inputCls, 'pl-9')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên, SĐT, địa chỉ, mã đơn…" aria-label="Tìm hội thoại" /></div>
          <div className="mt-2.5 flex flex-wrap gap-1" role="tablist" aria-label="Lọc hội thoại">
            {FTABS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={filter === id} onClick={() => setFilter(id)} className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium', filter === id ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.1)] text-[rgb(var(--accent-fg))]' : 'border-[rgb(var(--line))] text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')}>
                {label} <span className="tabular-nums">{counts[id]}</span>
              </button>
            ))}
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {list.map((c) => {
            const lk = (c.links ?? [])[0];
            const w = waitMin(c);
            return (
              <li key={c.id}>
                <button className={cn('flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left', c.id === cur?.id ? 'bg-[rgb(var(--secondary)/0.12)]' : 'hover:bg-[rgb(var(--ink)/0.04)]')} onClick={() => { setCurId(c.id); setCtxOpen(false); }}>
                  <span className="relative shrink-0">{c.avatar ? <img src={c.avatar} alt="" className="h-10 w-10 rounded-full object-cover" /> : <Avatar name={c.displayName} size={40} />}<span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[rgb(var(--surface))] bg-[#0068FF] text-[7px] font-semibold text-white" aria-hidden>Z</span></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><b className={cn('truncate text-sm', (c.unread ?? 0) > 0 ? 'font-semibold' : 'font-semibold')}>{c.displayName}</b><span className="ml-auto shrink-0 text-[11px] text-[rgb(var(--faint))]">{zTime(c.lastAt)}</span></span>
                    <span className={cn('mt-0.5 block truncate text-[13px]', (c.unread ?? 0) > 0 ? 'text-[rgb(var(--fg))]' : 'text-[rgb(var(--muted))]')}>{c.lastText}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      {lk && <span className="inline-flex max-w-[150px] items-center gap-1 truncate rounded bg-[rgb(var(--secondary)/0.1)] px-1.5 py-0.5 text-[11px] font-medium text-[rgb(var(--secondary-fg))]"><Link2 className="h-2.5 w-2.5 shrink-0" aria-hidden />{linkLabel(lk)}</span>}
                      {c.assignee ? <span className="text-[11px] text-[rgb(var(--muted))]">{userName(c.assignee)}</span> : <span className="text-[11px] font-medium text-[rgb(var(--accent-fg))]">Chưa nhận</span>}
                      {w >= hubCfg.zalo.replyMinutes && c.status !== 'CLOSED' && <span className="text-[11px] font-semibold text-[rgb(var(--danger-fg))]">Chờ {w >= 60 ? `${Math.round(w / 60)} giờ` : `${w} phút`}</span>}
                      {(c.unread ?? 0) > 0 && <span className="ml-auto rounded-full bg-[rgb(var(--danger))] px-1.5 text-[11px] font-semibold text-white">{c.unread}</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {!list.length && <li><EmptyState compact art="inbox" text={visible.length ? 'Không có hội thoại phù hợp' : 'Chưa có hội thoại Zalo'} hint={live ? 'Tin khách nhắn OA sẽ hiện ở đây.' : 'Kết nối Zalo OA ở Cài đặt > AI & Zalo Hub để nhận tin khách.'} /></li>}
        </ul>
      </aside>

      {/* ---------- Cột 2: khung chat ---------- */}
      <section className={cn('flex min-w-0 flex-1 flex-col', !cur && 'max-md:hidden')} aria-label="Khung chat">
        {cur ? (
          <>
            <header className="flex items-center gap-3 border-b border-[rgb(var(--line))] px-4 py-3">
              <button className="rounded p-1 md:hidden" onClick={() => setCurId(null)} aria-label="Quay lại danh sách"><ChevronLeft className="h-5 w-5" /></button>
              {cur.avatar ? <img src={cur.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <Avatar name={cur.displayName} size={36} />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{cur.displayName}</p>
                <p className="truncate text-xs text-[rgb(var(--muted))]">Zalo OA{cur.followed === false ? ' · đã bỏ quan tâm' : ''}{cust ? ` · ${cust.code}` : ''}{cur.assignee ? ` · ${userName(cur.assignee)} phụ trách` : ''}</p>
              </div>
              <select className={cn(inputBase, 'h-9 py-0 text-xs')} value={cur.status} onChange={(e) => patch(cur.id, (c) => ({ ...c, status: e.target.value as ZaloConvStatus }))} aria-label="Trạng thái hội thoại">
                {(Object.keys(ZSTATUS) as ZaloConvStatus[]).map((s) => <option key={s} value={s}>{ZSTATUS[s].label}</option>)}
              </select>
              <button className={cn(btnGhost, 'h-9 px-2 xl:hidden')} onClick={() => setCtxOpen((v) => !v)} aria-label="Thông tin khách hàng" aria-expanded={ctxOpen}><Info className="h-4 w-4" /></button>
            </header>
            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-[rgb(var(--sunken)/0.5)] px-4 py-4">
              {msgs.map((m) => m.dir === 'EVENT' ? (
                <p key={m.id} className="text-center text-[11px] text-[rgb(var(--muted))]">{m.text} · {zTime(m.at)}</p>
              ) : (
                <div key={m.id} className={cn('flex', m.dir === 'IN' ? 'justify-start' : 'justify-end')}>
                  <div className={cn('max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm', m.dir === 'IN' ? 'rounded-bl-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))]' : m.dir === 'NOTE' ? 'rounded-br-md border border-dashed border-[#F59E0B] bg-[#FEF3C7] text-[#78350F]' : 'rounded-br-md bg-[#0068FF] text-white')}>
                    {m.dir === 'NOTE' && <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold"><StickyNote className="h-3 w-3" aria-hidden />Ghi chú nội bộ · khách không thấy</p>}
                    {m.kind === 'zns' && <p className="mb-0.5 text-[11px] font-semibold opacity-80">Tin ZNS</p>}
                    {m.kind === 'image' && m.url && <img src={m.url} alt="Ảnh khách gửi" className="mb-1 max-h-56 rounded-lg" />}
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p className={cn('mt-1 flex items-center justify-end gap-1 text-[11px]', m.dir === 'OUT' ? 'text-white/75' : 'text-[rgb(var(--muted))]')}>
                      {m.dir !== 'IN' && m.by && <span>{m.by === 'zalo-oa' ? 'Gửi từ app Zalo OA' : userName(m.by)} ·</span>}{zTime(m.at)}
                      {m.status === 'SENDING' && ' · đang gửi'}{m.status === 'DEMO' && ' · mô phỏng'}{m.status === 'FAILED' && <b className="text-[#FECACA]"> · lỗi: {m.error}</b>}
                    </p>
                  </div>
                </div>
              ))}
              {!msgs.length && <p className="py-10 text-center text-sm text-[rgb(var(--muted))]">Chưa có tin nhắn</p>}
              <div ref={endRef} />
            </div>
            {canReply ? (
              <div className="border-t border-[rgb(var(--line))] p-3">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <div className="flex rounded-md border border-[rgb(var(--line))] p-0.5 text-xs" role="tablist" aria-label="Kiểu tin">
                    <button role="tab" aria-selected={mode === 'reply'} className={cn('rounded px-2.5 py-1 font-medium', mode === 'reply' ? 'bg-[#0068FF] text-white' : 'text-[rgb(var(--muted))]')} onClick={() => setMode('reply')}>Trả lời khách</button>
                    <button role="tab" aria-selected={mode === 'note'} className={cn('rounded px-2.5 py-1 font-medium', mode === 'note' ? 'bg-[#F59E0B] text-white' : 'text-[rgb(var(--muted))]')} onClick={() => setMode('note')}>Ghi chú nội bộ</button>
                  </div>
                  <div className="relative" ref={qrRef}>
                    <button className={cn(btnGhost, btnSm)} onClick={() => setQrOpen((v) => !v)} aria-expanded={qrOpen}><Zap className="h-3.5 w-3.5" aria-hidden />Mẫu nhanh</button>
                    {qrOpen && (
                      <ul className="absolute bottom-full left-0 z-30 mb-1 w-80 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--raised))] p-1 shadow-lg">
                        {hubCfg.zalo.quickReplies.map((r, i) => <li key={i}><button className="w-full rounded px-3 py-2 text-left text-xs hover:bg-[rgb(var(--ink)/0.05)]" onClick={() => { setText(fillVars(r, vars(cur))); setMode('reply'); setQrOpen(false); }}>{fillVars(r, vars(cur))}</button></li>)}
                        {!hubCfg.zalo.quickReplies.length && <li className="px-3 py-2 text-xs text-[rgb(var(--muted))]">Thêm mẫu ở Cài đặt &gt; AI & Zalo</li>}
                      </ul>
                    )}
                  </div>
                  <button className={cn(btnGhost, btnSm)} onClick={suggest} disabled={busy}><Sparkles className="h-3.5 w-3.5 text-[rgb(var(--accent))]" aria-hidden />{busy ? 'Đang soạn…' : 'Gợi ý trả lời'}</button>
                  <button className={cn(btnGhost, btnSm)} onClick={() => setWriter(true)}><PenLine className="h-3.5 w-3.5" aria-hidden />Soạn tin chăm sóc</button>
                  <span className="ml-auto text-[11px] text-[rgb(var(--faint))]">{ai.available ? `AI: ${ai.label}` : 'Gợi ý theo mẫu'}</span>
                </div>
                <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
                  <textarea className={cn(inputCls, 'min-h-[44px] flex-1 resize-none', mode === 'note' && 'border-[#F59E0B] bg-[#FEF3C7]/40')} rows={Math.min(5, Math.max(1, text.split('\n').length))} value={text} onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder={mode === 'note' ? 'Ghi chú cho đồng nghiệp (khách không thấy)…' : live && !cur.demo ? 'Nhập tin nhắn gửi khách qua Zalo OA… (Enter gửi, Shift+Enter xuống dòng)' : 'Nhập tin nhắn (mô phỏng, chưa gửi thật)…'} aria-label="Nội dung tin nhắn" />
                  <button className={cn(mode === 'note' ? btnGhost : btnPrimary, 'h-11')} disabled={!text.trim()} aria-label="Gửi"><Send className="h-4 w-4" aria-hidden /><span className="max-sm:hidden">{mode === 'note' ? 'Lưu ghi chú' : 'Gửi'}</span></button>
                </form>
              </div>
            ) : <p className="border-t border-[rgb(var(--line))] p-3 text-center text-xs text-[rgb(var(--muted))]">Vai trò của bạn chỉ xem hội thoại</p>}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6"><EmptyState art="inbox" text="Chọn một hội thoại" hint="Mỗi hội thoại tự liên kết với khách hàng, đơn hàng, dự án để lưu lịch sử tập trung." /></div>
        )}
      </section>

      {/* ---------- Cột 3: ngữ cảnh khách hàng / đơn hàng ---------- */}
      {cur && (
        <aside className={cn('w-[340px] shrink-0 flex-col overflow-y-auto border-l border-[rgb(var(--line))] bg-[rgb(var(--surface))]', ctxOpen ? 'flex max-xl:absolute max-xl:inset-y-0 max-xl:right-0 max-xl:z-20 max-xl:shadow-2xl max-sm:w-full' : 'hidden xl:flex')} aria-label="Thông tin khách hàng và đơn hàng">
          <div className="flex items-center gap-3 border-b border-[rgb(var(--line))] px-4 py-4">
            {cur.avatar ? <img src={cur.avatar} alt="" className="h-12 w-12 rounded-full object-cover" /> : <Avatar name={cur.displayName} size={48} />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{cur.displayName}</p>
              {cur.phone && <p className="flex items-center gap-1 text-xs text-[rgb(var(--muted))]"><Phone className="h-3 w-3" aria-hidden />{cur.phone}</p>}
              {cur.address && <p className="flex items-start gap-1 text-xs text-[rgb(var(--muted))]"><MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />{cur.address}</p>}
            </div>
            <button className="rounded p-1 xl:hidden" onClick={() => setCtxOpen(false)} aria-label="Đóng"><X className="h-4 w-4" /></button>
          </div>
          {section('Liên kết hồ sơ', (
            <>
              <div className="flex flex-wrap gap-1.5">
                {(cur.links ?? []).map((l) => (
                  <span key={`${l.kind}${l.id}`} className="inline-flex max-w-full items-center gap-1 rounded-full border border-[rgb(var(--secondary)/0.4)] bg-[rgb(var(--secondary)/0.08)] py-0.5 pl-2 pr-1 text-xs">
                    <span className="truncate"><b className="font-semibold">{ZLINK_LABEL[l.kind]}:</b> {linkLabel(l)}</span>{l.auto && <span className="text-[11px] text-[rgb(var(--muted))]">tự động</span>}
                    <button className="rounded-full p-0.5 hover:bg-[rgb(var(--ink)/0.08)]" onClick={() => patch(cur.id, (c) => ({ ...c, links: (c.links ?? []).filter((x) => !(x.kind === l.kind && x.id === l.id)) }))} aria-label={`Bỏ liên kết ${linkLabel(l)}`}><X className="h-3 w-3" /></button>
                  </span>
                ))}
                {!(cur.links ?? []).length && <p className="text-xs text-[rgb(var(--muted))]">Chưa liên kết. Chọn gợi ý bên dưới hoặc tìm thủ công.</p>}
              </div>
              {hits.filter((h) => !(cur.links ?? []).some((l) => l.kind === h.kind && l.id === h.id)).slice(0, 4).map((h) => (
                <div key={`${h.kind}${h.id}`} className="mt-2 flex items-center gap-2 rounded-md border border-[rgb(var(--line))] px-2.5 py-2">
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{ZLINK_LABEL[h.kind]}: {h.label}</p><p className="truncate text-[11px] text-[rgb(var(--muted))]">{h.why} · khớp {h.score}%</p></div>
                  <button className={cn(btnGhost, btnSm)} onClick={() => addLink(h)}>Liên kết</button>
                </div>
              ))}
              <input className={cn(inputCls, 'mt-2 h-9 py-1 text-xs')} value={linkQ} onChange={(e) => setLinkQ(e.target.value)} placeholder="Tìm khách hàng, mã đơn, dự án để liên kết…" aria-label="Tìm hồ sơ để liên kết" />
              {linkFound.map((h) => <button key={`${h.kind}${h.id}`} className="mt-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-[rgb(var(--ink)/0.05)]" onClick={() => { addLink(h); setLinkQ(''); }}><Plus className="h-3 w-3" aria-hidden /><span className="truncate">{ZLINK_LABEL[h.kind]}: {h.label} <span className="text-[rgb(var(--muted))]">{h.sub}</span></span></button>)}
            </>
          ))}
          {cust && section('Khách hàng', (
            <div className="space-y-1.5 text-xs">
              <p className="text-sm font-semibold">{cust.name} <span className="font-normal text-[rgb(var(--muted))]">{cust.code}</span></p>
              <p className="text-[rgb(var(--muted))]">{cust.contactName}{cust.contactPhone ? ` · ${cust.contactPhone}` : ''}</p>
              <p className="text-[rgb(var(--muted))]">{cust.address}</p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-md bg-[rgb(var(--sunken))] px-2.5 py-2"><p className="text-[11px] uppercase text-[rgb(var(--muted))]">Doanh số năm nay</p><p className="font-num font-semibold">{compact(cust.ytdRevenue)}</p></div>
                <div className="rounded-md bg-[rgb(var(--sunken))] px-2.5 py-2"><p className="text-[11px] uppercase text-[rgb(var(--muted))]">Công nợ</p><p className={cn('font-num font-semibold', cust.debt > cust.creditLimit && 'text-[rgb(var(--danger-fg))]')}>{compact(cust.debt)}</p></div>
              </div>
              <p>Phụ trách: <b>{userName(cust.amId)}</b></p>
            </div>
          ), <button className="text-xs font-medium text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => app.openCustomer(cust.id)}>Mở hồ sơ</button>)}
          {(related.jobs.length > 0 || related.leads.length > 0 || custQuotes.length > 0) && section('Đơn hàng · dự án · báo giá', (
            <ul className="space-y-1.5">
              {related.jobs.slice(0, 5).map((j) => { const st = JOB_STAGE[jobStageOf(j, app.workOrders, app.installJobs, app.receipts)]; return (
                <li key={j.id}><button className="w-full rounded-md border border-[rgb(var(--line))] px-2.5 py-2 text-left hover:border-[rgb(var(--secondary)/0.6)]" onClick={() => app.openJob(j.id)}>
                  <span className="flex items-center gap-2 text-xs"><b className="code-chip">{j.code}</b><span className="ml-auto"><Chip tone={st.tone}>{st.short}</Chip></span></span>
                  <span className="mt-0.5 block truncate text-xs">{j.title}</span>
                  {j.contractValue ? <span className="text-[11px] text-[rgb(var(--muted))]">Giá trị HĐ {compact(j.contractValue)}</span> : null}
                </button></li>
              ); })}
              {related.leads.slice(0, 5).map((l) => (
                <li key={l.id}><button className="w-full rounded-md border border-[rgb(var(--line))] px-2.5 py-2 text-left hover:border-[rgb(var(--secondary)/0.6)]" onClick={() => app.go(['ACCEPTED', 'QUOTED', 'WON', 'LOST'].includes(l.status) ? 'projects' : 'leads', l.code)}>
                  <span className="flex items-center gap-2 text-xs"><b className="code-chip">{l.code}</b><span className="ml-auto"><Chip tone={LEAD_STATUS[l.status].tone}>{LEAD_STATUS[l.status].label}</Chip></span></span>
                  <span className="mt-0.5 block truncate text-xs">{l.company} · {compact(boqTotal(l))}</span>
                </button></li>
              ))}
              {custQuotes.map((x) => <li key={x.id} className="flex items-center justify-between rounded-md bg-[rgb(var(--sunken))] px-2.5 py-1.5 text-xs"><span className="font-mono">{x.code}</span><span className="font-num">{compact(x.amount)}</span></li>)}
            </ul>
          ))}
          {section('Phụ trách & phân loại', (
            <div className="space-y-2">
              <select className={cn(inputCls, 'h-9 py-0 text-xs')} value={cur.assignee ?? ''} disabled={!canAssign && cur.assignee !== undefined && cur.assignee !== me.id} onChange={(e) => { const v = e.target.value || undefined; patch(cur.id, (c) => ({ ...c, assignee: v })); audit('ZALO_ASSIGN', `${cur.displayName} → ${userName(v)}`); }} aria-label="Người phụ trách">
                <option value="">Chưa giao</option>
                {users.filter((u) => u.active && (canAssign || u.id === me.id)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <input className={cn(inputCls, 'h-9 py-1 text-xs')} defaultValue={(cur.tags ?? []).join(', ')} key={cur.id} onBlur={(e) => patch(cur.id, (c) => ({ ...c, tags: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }))} placeholder="Nhãn, cách nhau dấu phẩy (VD: bảo hành, VIP)" aria-label="Nhãn hội thoại" />
            </div>
          ))}
          {section('Hành động', (
            <div className="grid gap-2">
              <button className={cn(btnGhost, 'justify-start')} onClick={() => setZns(true)}><BellRing className="h-4 w-4" aria-hidden />Gửi tin ZNS theo mẫu</button>
              <button className={cn(btnGhost, 'justify-start')} onClick={() => setWriter(true)}><Sparkles className="h-4 w-4 text-[rgb(var(--accent))]" aria-hidden />Soạn nội dung chăm sóc</button>
              {!cust && <button className={cn(btnGhost, 'justify-start')} onClick={() => app.openCustomerForm()}><UserPlus className="h-4 w-4" aria-hidden />Tạo khách hàng mới</button>}
            </div>
          ))}
        </aside>
      )}
      {zns && cur && <ZnsSendSheet conv={cur} cust={cust} job={related.jobs[0]} onClose={() => setZns(false)} />}
      {writer && cur && <AiWriterSheet preset="CARE_MSG" context={[`Khách: ${cur.displayName}${cur.address ? `, ${cur.address}` : ''}`, cust && `Mã khách ${cust.code}, doanh số năm nay ${compact(cust.ytdRevenue)}`, ...(cur.links ?? []).map((l) => `${ZLINK_LABEL[l.kind]}: ${linkLabel(l)}`), `Tin gần nhất của khách: ${[...msgs].reverse().find((m) => m.dir === 'IN')?.text ?? ''}`].filter(Boolean).join('\n')}
        onUse={(v) => { setText(v); setMode('reply'); }} onClose={() => setWriter(false)} />}
    </div>
  );
}

/** Gửi ZNS theo mẫu đã duyệt: tham số tự điền từ khách hàng / đơn hàng đang liên kết */
export function ZnsSendSheet({ conv, cust, job, onClose }: { conv: ZaloConv; cust?: Customer; job?: Job; onClose: () => void }) {
  const app = useApp();
  const { hubCfg, setZaloMsgs, setZaloConvs, addMsgLog, me, company, notify, go } = app;
  const [srv] = useServerStatus();
  const tpls = hubCfg.zalo.znsTemplates;
  const [tid, setTid] = useState(tpls[0]?.id ?? '');
  const tpl = tpls.find((x) => x.id === tid);
  const src = (s: string): string => ({
    'customer.name': cust?.contactName || cust?.name || conv.displayName, 'customer.phone': cust?.contactPhone || conv.phone || '', 'customer.code': cust?.code ?? '',
    'order.code': job?.code ?? '', 'order.title': job?.title ?? '', 'order.amount': job?.contractValue ? fmtN(job.contractValue) : '', 'order.date': job?.appointmentAt ? new Date(job.appointmentAt).toLocaleString('vi-VN') : '',
    'company.name': company.shortName || company.appName, 'staff.name': me?.name ?? '', today: new Date().toLocaleDateString('vi-VN'),
  } as Record<string, string>)[s] ?? '';
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => { setVals(Object.fromEntries((tpl?.params ?? []).map((p) => [p.key, src(p.source)]))); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tid]);
  const [phone, setPhone] = useState(cust?.contactPhone || conv.phone || '');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!tpl) return;
    setBusy(true);
    const live = srv.zalo.oa && !conv.demo;
    const r = live ? await apiPost<{ msgId?: string }>('/api/zalo/zns', { tenant: app.org.id, phone, templateId: tpl.templateId, data: vals, trackingId: `${conv.id}-${Date.now()}` }) : { ok: true, error: undefined };
    setBusy(false);
    const text = `[${tpl.name}] ${Object.entries(vals).map(([k, v]) => `${k}: ${v}`).join(', ')}`;
    setZaloMsgs((p) => [...p, { id: uid('zm'), convId: conv.id, dir: 'OUT', kind: 'zns', text, at: Date.now(), by: me?.id, status: live ? (r.ok ? 'SENT' : 'FAILED') : 'DEMO', error: r.ok ? undefined : aiErrText(r.error) }]);
    setZaloConvs((p) => p.map((c) => (c.id === conv.id ? { ...c, lastAt: Date.now(), lastText: `ZNS: ${tpl.name}` } : c)));
    addMsgLog({ channel: 'ZNS', to: phone, subject: tpl.name, ok: r.ok, detail: live ? (r.ok ? 'Đã gửi qua Zalo ZNS' : aiErrText(r.error)) : 'Mô phỏng (máy chủ chưa cấu hình Zalo)' });
    notify(r.ok ? (live ? 'Đã gửi tin ZNS' : 'Đã ghi tin ZNS (mô phỏng)') : `Gửi ZNS lỗi: ${aiErrText(r.error)}`, r.ok ? 'teal' : 'red');
    if (r.ok) onClose();
  };
  return (
    <SideSheet title="Gửi tin ZNS" sub={conv.displayName} onClose={onClose} footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} disabled={!tpl || !/\d{9,}/.test(phone.replace(/\D/g, '')) || busy} onClick={send}>{busy ? 'Đang gửi…' : 'Gửi ZNS'}</button></>}>
      {!tpls.length ? (
        <EmptyState compact art="doc" text="Chưa khai báo mẫu ZNS" hint="Mẫu ZNS phải được Zalo duyệt trước. Khai báo template ID và tham số ở Cài đặt > AI & Zalo." action="Mở cài đặt" onAction={() => { onClose(); stickyStore.set('SettingsModule.tab', 'hub'); go('settings'); }} />
      ) : (
        <div className="space-y-4">
          <Field label="Mẫu tin"><select className={inputCls} value={tid} onChange={(e) => setTid(e.target.value)}>{tpls.map((x) => <option key={x.id} value={x.id}>{x.name} (ID {x.templateId})</option>)}</select></Field>
          <Field label="Số điện thoại nhận" hint="Số đăng ký Zalo của khách"><input type="tel" autoComplete="tel" className={inputCls} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          {(tpl?.params ?? []).map((p) => (
            <Field key={p.key} label={`${p.key}${p.source ? ` · ${ZNS_SOURCES[p.source] ?? p.source}` : ''}`}><input className={inputCls} value={vals[p.key] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [p.key]: e.target.value }))} /></Field>
          ))}
          {!srv.zalo.oa && <p className="rounded-md bg-[rgb(var(--accent)/0.08)] px-3 py-2 text-xs text-[rgb(var(--accent-fg))]">Máy chủ chưa cấu hình Zalo: tin sẽ được ghi nhận ở chế độ mô phỏng, không gửi thật.</p>}
        </div>
      )}
    </SideSheet>
  );
}

