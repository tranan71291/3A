'use client';

import { AtSign, ExternalLink, Hash, MessageSquare, Send } from 'lucide-react';
import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react';
import { Avatar } from './controls';
import { EmptyState, SideSheet } from './ui';
import { boqTotal, compact, fold, jobCustName, LEAD_STATUS, ROLE_LABEL, useApp } from '../lib/core';
import type { CommentEntity, DeepLink, Module, User } from '../lib/types';
import { cn } from '../lib/utils';

export function useDeepLinks(): DeepLink[] {
  const { leads, customers, jobs, pos, claims, programs, go, openCustomer, openJob, openClaim, canSee } = useApp();
  return [
    ...(canSee('reports') ? [
      { token: 'Báo-cáo-quỹ-MDF', label: 'Báo cáo quyết toán quỹ MDF', sub: 'Tài chính', open: () => go('reports') },
      { token: 'Công-nợ', label: 'Công nợ & tuổi nợ', sub: 'Tài chính', open: () => go('reports') },
    ] : []),
    { token: 'Dự-báo', label: 'Dự báo doanh thu & cảnh báo', sub: 'Tổng quan', open: () => go('overview') },
    ...leads.map((l) => ({ token: l.code, label: l.company, sub: `${LEAD_STATUS[l.status].label} · ${compact(boqTotal(l))}`, open: () => go(['ACCEPTED', 'QUOTED', 'WON', 'LOST'].includes(l.status) ? 'projects' : 'leads', l.code) })),
    ...customers.map((c) => ({ token: c.code, label: c.name, sub: `Khách hàng · nợ ${compact(c.debt)}`, open: () => { go('customers'); openCustomer(c.id); } })),
    ...jobs.map((j) => ({ token: j.code, label: j.title || jobCustName(j, customers), sub: 'Đơn hàng công trình', open: () => openJob(j.id) })),
    ...pos.map((p) => ({ token: p.code, label: `${p.vendor}`, sub: `PO · ${p.lines.length} SKU`, open: () => go('supply', p.code) })),
    ...claims.map((c) => ({ token: c.code, label: c.programTitle, sub: 'Hồ sơ claim MDF', open: () => openClaim(c.id) })),
    ...programs.map((p) => ({ token: p.code, label: p.title, sub: 'Chương trình quỹ', open: () => go('claims') })),
  ];
}

/** Hiển thị nội dung bình luận: tô sáng @Tên, biến #MÃ thành nút mở đúng dữ liệu */
export function MentionText({ text }: { text: string }) {
  const { users } = useApp();
  const links = useDeepLinks();
  const names = users.map((u) => u.name).sort((a, b) => b.length - a.length);
  const esc2 = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pat = [names.length ? `@(?:${names.map(esc2).join('|')})` : '', '#[\\p{L}\\p{N}][\\p{L}\\p{N}\\-_/.]*[\\p{L}\\p{N}]'].filter(Boolean).join('|');
  const parts = text.split(new RegExp(`(${pat})`, 'gu'));
  return <>{parts.map((p, i) => {
    if (p.startsWith('@') && names.includes(p.slice(1))) return <span key={i} className="rounded-sm bg-[rgb(var(--secondary)/0.25)] px-1 font-medium text-[rgb(var(--secondary-fg))]">{p}</span>;
    if (p.startsWith('#')) {
      const d = links.find((x) => x.token.toLowerCase() === p.slice(1).toLowerCase());
      if (d) return <button key={i} type="button" onClick={d.open} title={`${d.label} · ${d.sub}`} className="mx-0.5 inline-flex items-center gap-1 rounded-sm border border-[rgb(var(--accent)/0.4)] bg-[rgb(var(--accent)/0.1)] px-1.5 align-baseline font-mono text-[12px] font-semibold text-[rgb(var(--accent-fg))] hover:bg-[rgb(var(--accent)/0.2)]"><ExternalLink className="h-3 w-3" aria-hidden />{d.token}</button>;
    }
    return <Fragment key={i}>{p}</Fragment>;
  })}</>;
}

/** Ô soạn bình luận có gợi ý @nhắc tên (↑ ↓ Enter để chọn) */
export function MentionComposer({ onSend, placeholder = 'Viết bình luận, gõ @ để nhắc đồng nghiệp, # để chèn liên kết…', toolbar, canSendEmpty, rows = 3 }: { onSend: (text: string, mentions: string[]) => void; placeholder?: string; toolbar?: ReactNode; canSendEmpty?: boolean; rows?: number }) {
  const { users, me } = useApp();
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState<string | null>(null);
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const links = useDeepLinks();
  const caretRef = useRef<number | null>(null);
  const [trig, setTrig] = useState<'@' | '#'>('@');
  type Opt = { key: string; label: string; sub: string; user?: User; link?: DeepLink };
  const opts: Opt[] = q === null ? [] : trig === '@'
    ? users.filter((u) => u.active && u.id !== me?.id && fold(u.name).includes(fold(q))).slice(0, 6).map((u) => ({ key: u.id, label: u.name, sub: ROLE_LABEL[u.role], user: u }))
    : links.filter((d) => !q || fold(`${d.token} ${d.label}`).includes(fold(q))).slice(0, 7).map((d) => ({ key: d.token, label: d.token, sub: `${d.label} · ${d.sub}`, link: d }));
  const onChange = (v: string, caret: number) => {
    setText(v);
    const m = /(^|\s)([@#])([^\s@#]{0,24})$/.exec(v.slice(0, caret));
    setQ(m ? m[3] : null);
    if (m) setTrig(m[2] as '@' | '#');
    setHi(0);
  };
  const choose = (o: Opt) => {
    const el = ref.current;
    const caret = el?.selectionStart ?? text.length;
    const ins = o.user ? `@${o.user.name} ` : `#${o.link!.token} `;
    const before = text.slice(0, caret).replace(/[@#]([^\s@#]{0,24})$/, ins);
    const next = before + text.slice(caret);
    setText(next);
    if (o.user) setPicked((p) => (p.includes(o.user!.id) ? p : [...p, o.user!.id]));
    setQ(null);
    caretRef.current = before.length;
  };
  // Đặt lại con trỏ ngay sau khi chèn @Tên / #MÃ (trước khi người dùng gõ tiếp)
  useEffect(() => {
    if (caretRef.current === null) return;
    const el = ref.current;
    el?.focus();
    el?.setSelectionRange(caretRef.current, caretRef.current);
    caretRef.current = null;
  }, [text]);
  const send = () => {
    const t = text.trim();
    if (!t && !canSendEmpty) return;
    const mentions = picked.filter((id) => { const u = users.find((x) => x.id === id); return !!u && t.includes(`@${u.name}`); });
    onSend(t, mentions);
    setText(''); setPicked([]); setQ(null);
  };
  return (
    <div className="relative">
      {opts.length > 0 && (
        <ul className="absolute bottom-full left-0 z-10 mb-1.5 w-full overflow-hidden rounded-md border border-[rgb(var(--ink)/0.1)] bg-[rgb(var(--raised))] py-1 shadow-2xl" role="listbox" aria-label={trig === '@' ? 'Nhắc tên' : 'Chèn liên kết dữ liệu'}>
          <li className="px-3 pb-1 pt-0.5 text-[11px] font-semibold text-[rgb(var(--faint))]">{trig === '@' ? 'Nhắc đồng nghiệp' : 'Liên kết tới dự án / đơn / báo cáo'}</li>
          {opts.map((o, i) => (
            <li key={o.key} role="option" aria-selected={i === hi}>
              <button type="button" className={cn('flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm', i === hi ? 'bg-[rgb(var(--secondary)/0.3)]' : 'hover:bg-[rgb(var(--ink)/0.05)]')} onMouseDown={(e) => { e.preventDefault(); choose(o); }}>
                {o.user ? <Avatar name={o.user.name} size={22} /> : <Hash className="h-4 w-4 shrink-0 text-[rgb(var(--accent-fg))]" aria-hidden />}
                <span className={cn('min-w-0 shrink-0 truncate', o.link && 'font-mono text-xs font-semibold')}>{o.label}</span><span className="min-w-0 flex-1 truncate text-right text-[11px] text-[rgb(var(--muted))]">{o.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="rounded-lg border border-[rgb(var(--ink)/0.1)] bg-[rgb(var(--sunken))] transition-colors focus-within:border-[rgb(var(--secondary)/0.7)]">
        <div className="flex items-center gap-0.5 px-2 pt-1.5">
          <button type="button" className="flex h-7 w-7 items-center justify-center rounded text-[rgb(var(--faint))] transition-colors hover:bg-[rgb(var(--ink)/0.06)] hover:text-[rgb(var(--fg))]" title="Nhắc tên (@)" aria-label="Nhắc tên đồng nghiệp" onClick={() => { const v = `${text}${text && !text.endsWith(' ') ? ' ' : ''}@`; setText(v); setTrig('@'); setQ(''); ref.current?.focus(); }}><AtSign className="h-4 w-4" aria-hidden /></button>
          <button type="button" className="flex h-7 w-7 items-center justify-center rounded text-[rgb(var(--faint))] transition-colors hover:bg-[rgb(var(--ink)/0.06)] hover:text-[rgb(var(--fg))]" title="Chèn liên kết tới dự án / đơn / báo cáo (#)" aria-label="Chèn liên kết dữ liệu" onClick={() => { const v = `${text}${text && !text.endsWith(' ') ? ' ' : ''}#`; setText(v); setTrig('#'); setQ(''); ref.current?.focus(); }}><Hash className="h-4 w-4" aria-hidden /></button>
          {toolbar}
          <span className="ml-auto hidden pr-1 text-[11px] text-[rgb(var(--faint))] sm:inline">Enter gửi · Shift + Enter xuống dòng</span>
        </div>
        <div className="flex items-end gap-2 px-3 pb-2">
          <textarea
            ref={ref}
            rows={rows}
            className="block min-h-[44px] w-full flex-1 resize-none bg-transparent py-2 text-[15px] leading-relaxed text-[rgb(var(--fg))] placeholder:text-[rgb(var(--faint))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--fg)/0.4)]"
            value={text}
            placeholder={placeholder}
            aria-label="Nội dung bình luận"
            onChange={(e) => onChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
            onKeyDown={(e) => {
              if (opts.length) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, opts.length - 1)); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); return; }
                if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(opts[hi]); return; }
                if (e.key === 'Escape') { e.stopPropagation(); setQ(null); return; }
              }
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
            }}
          />
          {/* Nút gửi dạng icon: chỉ nổi bật khi đã có nội dung */}
          <button type="button" onClick={send} disabled={!text.trim() && !canSendEmpty} aria-label="Gửi" title="Gửi (Enter)"
            className={cn('mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-200', text.trim() || canSendEmpty ? 'g-brand text-[rgb(var(--on-accent))] shadow-[0_6px_18px_-6px_rgba(242,140,51,.8)] hover:brightness-110' : 'text-[rgb(var(--faint))]')}>
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Nút bình luận trên dòng bảng: hiện số bình luận, chấm xanh nếu có người nhắc mình; bấm mở khung trượt thảo luận */
export function CommentButton({ entity, entityId, title, module }: { entity: CommentEntity; entityId: string; title: string; module: Module }) {
  const { comments, me } = useApp();
  const [open, setOpen] = useState(false);
  const list = comments.filter((c) => c.entity === entity && c.entityId === entityId);
  const mentioned = !!me && list.some((c) => c.mentions.includes(me.id));
  return (
    <>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }} title={list.length ? `${list.length} bình luận` : 'Bình luận, nhắc tên đồng nghiệp'} aria-label={`Bình luận về ${title}${list.length ? `, ${list.length} bình luận` : ''}`}
        className={cn('relative inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded border px-1.5 text-xs transition-colors', list.length ? 'border-[rgb(var(--secondary)/0.5)] text-[rgb(var(--secondary-fg))] hover:bg-[rgb(var(--secondary)/0.2)]' : 'border-[rgb(var(--ink)/0.08)] text-[rgb(var(--muted))] hover:border-[rgb(var(--secondary))] hover:text-[rgb(var(--fg))]')}>
        <MessageSquare className="h-3.5 w-3.5" aria-hidden />{list.length > 0 && <span className="tabular-nums">{list.length}</span>}
        {mentioned && <i className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[rgb(var(--bg))] bg-[rgb(var(--accent))]" aria-hidden />}
      </button>
      {open && <CommentSheet entity={entity} entityId={entityId} title={title} module={module} onClose={() => setOpen(false)} />}
    </>
  );
}

export function CommentSheet({ entity, entityId, title, module, onClose }: { entity: CommentEntity; entityId: string; title: string; module: Module; onClose: () => void }) {
  const { comments, addComment, userName, me } = useApp();
  const list = comments.filter((c) => c.entity === entity && c.entityId === entityId).sort((a, b) => a.at - b.at);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [list.length]);
  return (
    <SideSheet title="Thảo luận" sub={title} onClose={onClose} width="sm:w-[440px]" footer={<div className="w-full"><MentionComposer onSend={(text, mentions) => addComment({ entity, entityId, text, mentions, module }, title)} /></div>}>
      {!list.length ? (
        <EmptyState text={<>Chưa có trao đổi nào</>} hint={<>Gõ @ để nhắc đồng nghiệp xử lý dòng này. Người được nhắc nhận thông báo ngay trong chuông thông báo.</>} art="inbox" />
      ) : (
        <ol className="space-y-4">
          {list.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={userName(c.authorId)} size={30} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-xs"><b className="text-sm text-[rgb(var(--fg))]">{c.authorId === me?.id ? 'Bạn' : userName(c.authorId)}</b><span className="text-[rgb(var(--faint))]">{new Date(c.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span></p>
                <p className="mt-1 whitespace-pre-wrap break-words rounded-md rounded-tl-none bg-[rgb(var(--ink)/0.04)] px-3 py-2 text-sm leading-relaxed text-[rgb(var(--fg2))]"><MentionText text={c.text} /></p>
              </div>
            </li>
          ))}
          <div ref={endRef} />
        </ol>
      )}
    </SideSheet>
  );
}

