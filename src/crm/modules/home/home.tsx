'use client';

import { ArrowLeft, Bookmark, Cake, CheckCircle2, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, Eye, EyeOff, FolderOpen, Globe, House, ImagePlus, Lightbulb, MapPin, Megaphone, MessageCircle, Newspaper, Paperclip, PenLine, Pencil, Pin, Plus, Share2, SmilePlus, Sparkles, SquarePlay, ThumbsUp, Trash2, Trophy, UserPlus, Vote, Wallet, X } from 'lucide-react';
import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react';
import { removeWithUndo } from '../../app/context';
import { PAvatar, useOutsideClose } from '../../app/header';
import { MentionComposer, MentionText } from '../../components/comments';
import { RowMenu } from '../../components/controls';
import { ConfirmDialog } from '../../components/crud';
import { Chip, EmptyState, useEscClose, useOverlay, useSticky } from '../../components/ui';
import { bizMode, boqTotal, btnGhost, btnPrimary, btnSm, canViewDoc, chatFileMax, compact, dmId, FB_ICON, FEELINGS, firstName, fmtDate, fmtSize, fold, HOME_FOCUS_EVT, inputBase, inputCls, isMedia, leadDate, portal, POST_KIND, reactOf, REACTS, reactTotal, ROLE_LABEL, seenThisSession, summarizeText, uid, useApp, withReact } from '../../lib/core';
import type { ChatFile, ConfirmState, FeedAuto, Post, PostFeeling, PostKind, ReactId, ToastT } from '../../lib/types';
import { cn } from '../../lib/utils';
import { jobMoney } from '../../lib/workshop';
import { WidgetCard } from '../dashboard/widget-board';
import { AssistantCommandBar, SocialHubWidget } from './social-hub';
import { stShrinkImage } from '../marketing/content-studio';
import { ChatFiles } from '../messages/messenger';
import { useTaskCount } from '../tasks/tasks';

/** Thời gian kiểu Facebook: 5 phút · 3 giờ · Hôm qua lúc 14:30 · 21 tháng 8 lúc 10:00 · 21 tháng 8, 2024 */
export function fbTime(at: number) {
  const d = new Date(at), now = new Date(), m = Math.round((now.getTime() - at) / 60000);
  if (m < 1) return 'Vừa xong';
  if (m < 60) return `${m} phút`;
  if (m < 1440 && d.getDate() === now.getDate()) return `${Math.round(m / 60)} giờ`;
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate()) return `Hôm qua lúc ${hm}`;
  return d.getFullYear() === now.getFullYear() ? `${d.getDate()} tháng ${d.getMonth() + 1} lúc ${hm}` : `${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
}

/** Đọc file người dùng chọn: ảnh nén về ≤ 1600px (JPEG) cho nhẹ, video / tài liệu giữ nguyên trong giới hạn dung lượng */
export async function readPostFiles(fs: File[], notify: (m: string, t?: ToastT['tone']) => void): Promise<ChatFile[]> {
  const out: ChatFile[] = [];
  for (const f of fs) {
    try {
      if (/^image\/(jpeg|png|webp|heic|heif)$/.test(f.type)) {
        const url = await stShrinkImage(f, 1600);
        out.push({ name: f.name.replace(/\.\w+$/, '') + '.jpg', type: 'image/jpeg', url, size: Math.round(((url.length - url.indexOf(',') - 1) * 3) / 4) });
        continue;
      }
      if (f.size > chatFileMax()) { notify(`${f.name} vượt ${fmtSize(chatFileMax())}`, 'red'); continue; }
      const url = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('read')); r.readAsDataURL(f); });
      out.push({ name: f.name, size: f.size, type: f.type || 'application/octet-stream', url });
    } catch { notify(`Không đọc được ${f.name}`, 'red'); }
  }
  return out;
}

/** Lưới ảnh / video kiểu Facebook: 1 ảnh to · 2 ảnh đôi · 3 ảnh (1 lớn + 2) · 4 ảnh (1 lớn + 3) · 5+ ảnh (1 lớn + 4, ô cuối "+N") */
export function PhotoGrid({ files, onOpen }: { files: ChatFile[]; onOpen: (i: number) => void }) {
  const n = files.length;
  if (!n) return null;
  const cell = (f: ChatFile, i: number, cls = '', more = 0) => (
    <button key={i} type="button" onClick={() => onOpen(i)} className={cn('group relative block h-full w-full overflow-hidden bg-[rgb(var(--ink)/0.06)]', cls)} aria-label={`Xem ${f.type.startsWith('video/') ? 'video' : 'ảnh'} ${i + 1}/${n}`}>
      {f.type.startsWith('video/')
        ? <><video src={f.url} className="h-full w-full object-cover" muted preload="metadata" /><span className="absolute inset-0 flex items-center justify-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white"><SquarePlay className="h-6 w-6" aria-hidden /></span></span></>
        : <img src={f.url} alt="" loading="lazy" className="h-full w-full object-cover transition-opacity group-hover:opacity-95" />}
      {more > 0 && <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-3xl font-semibold text-white">+{more}</span>}
    </button>
  );
  if (n === 1) return files[0].type.startsWith('video/')
    ? <video src={files[0].url} controls preload="metadata" className="max-h-[620px] w-full bg-black" />
    : <button type="button" onClick={() => onOpen(0)} className="block w-full bg-[rgb(var(--ink)/0.05)]" aria-label="Xem ảnh"><img src={files[0].url} alt="" loading="lazy" className="mx-auto max-h-[620px] w-full object-contain" /></button>;
  if (n === 2) return <div className="grid grid-cols-2 gap-0.5">{files.map((f, i) => <div key={i} className="aspect-square">{cell(f, i)}</div>)}</div>;
  if (n === 3) return <div className="grid aspect-[4/3] grid-cols-2 grid-rows-2 gap-0.5">{cell(files[0], 0, 'row-span-2')}{cell(files[1], 1)}{cell(files[2], 2)}</div>;
  if (n === 4) return <div className="grid aspect-square grid-cols-3 grid-rows-[2fr_1fr] gap-0.5">{cell(files[0], 0, 'col-span-3')}{files.slice(1).map((f, i) => cell(f, i + 1))}</div>;
  return <div className="grid aspect-[16/10] grid-cols-[1.25fr_1fr_1fr] grid-rows-2 gap-0.5">{cell(files[0], 0, 'row-span-2')}{files.slice(1, 5).map((f, i) => cell(f, i + 1, '', i === 3 ? n - 5 : 0))}</div>;
}

/** Xem ảnh toàn màn hình: ← → để chuyển, Esc để đóng */
export function PhotoViewer({ files, start, onClose }: { files: ChatFile[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const ov = useOverlay();
  useEscClose(ov.id, onClose);
  const f = files[i];
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') setI((x) => Math.min(files.length - 1, x + 1)); if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1)); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [files.length]);
  if (!f) return null;
  return portal(
    <div className={cn('fixed inset-0 z-[80] flex items-center justify-center bg-black/90', !ov.top && 'invisible')} role="dialog" aria-modal="true" aria-label="Xem ảnh" onClick={onClose}>
      <div className="absolute right-3 top-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <span className="text-sm text-white/80 tabular-nums">{i + 1} / {files.length}</span>
        <a href={f.url} download={f.name} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Tải về"><Download className="h-5 w-5" /></a>
        <button className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20" onClick={onClose} aria-label="Đóng"><X className="h-5 w-5" /></button>
      </div>
      {i > 0 && <button className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setI(i - 1); }} aria-label="Ảnh trước"><ChevronLeft className="h-6 w-6" /></button>}
      {i < files.length - 1 && <button className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setI(i + 1); }} aria-label="Ảnh sau"><ChevronRight className="h-6 w-6" /></button>}
      <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] max-w-[92vw]">
        {f.type.startsWith('video/') ? <video src={f.url} controls autoPlay className="max-h-[92vh] max-w-[92vw]" /> : <img src={f.url} alt="" className="max-h-[92vh] max-w-[92vw] object-contain" />}
      </div>
    </div>,
  );
}

/** Câu đầu bài kiểu Facebook: "đang 😎 cảm thấy tuyệt cùng A và B tại Hà Nội." */
export function PostHeadline({ p, name }: { p: Post; name: ReactNode }) {
  const { userName } = useApp();
  const tg = (p.tagged ?? []).map((id) => userName(id)).filter(Boolean);
  const people = tg.length === 0 ? null : tg.length <= 2 ? tg.map((t, i) => <Fragment key={t}>{i ? ' và ' : ''}<b className="font-semibold">{t}</b></Fragment>) : <><b className="font-semibold">{tg[0]}</b> và <b className="font-semibold">{tg.length - 1} người khác</b></>;
  return (
    <p className="text-[15px] leading-snug text-[rgb(var(--fg))]">
      {name}
      {p.feeling && <> đang {p.feeling.emoji} {p.feeling.verb === 'feel' ? 'cảm thấy ' : ''}{p.feeling.label}</>}
      {people && <> cùng {people}</>}
      {p.place && <> tại <b className="font-semibold">{p.place}</b></>}
      {p.sharedId && !p.feeling && !people && !p.place && <span className="text-[rgb(var(--muted))]"> đã chia sẻ một bài viết</span>}
      {(p.feeling || people || p.place) && '.'}
    </p>
  );
}

/**
 * Khung "Tạo bài viết" kiểu Facebook (một khung duy nhất, các bước chọn cảm xúc / gắn thẻ / địa điểm đổi trang ngay trong khung,
 * không mở thêm cửa sổ chồng lên).
 */
export function PostComposer({ edit, sharing, start = 'main', pick, onClose }: { edit?: Post; sharing?: Post; start?: 'main' | 'feeling' | 'tag' | 'place' | 'poll'; pick?: boolean; onClose: () => void }) {
  const { me, users, posts, setPosts, addComment, canDo, notify, company } = useApp();
  const ov = useOverlay();
  const mod = canDo('feed.moderate');
  const canPoll = canDo('feed.poll');
  const kinds = (['POST', 'IDEA', ...(mod ? ['ANNOUNCE'] : []), ...(canPoll ? ['POLL'] : [])] as PostKind[]);
  const [view, setView] = useState<'main' | 'feeling' | 'tag' | 'place'>(start === 'poll' ? 'main' : start);
  const [kind, setKind] = useState<PostKind>(edit?.kind ?? (start === 'poll' && canPoll ? 'POLL' : 'POST'));
  const [text, setText] = useState(edit?.text ?? '');
  const [files, setFiles] = useState<ChatFile[]>(edit?.files ?? []);
  const [feeling, setFeeling] = useState<PostFeeling | undefined>(edit?.feeling);
  const [tagged, setTagged] = useState<string[]>(edit?.tagged ?? []);
  const [place, setPlace] = useState(edit?.place ?? '');
  const [opts, setOpts] = useState<string[]>(['', '']);
  const [multi, setMulti] = useState(false);
  const [closes, setCloses] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const dirty = !!(text.trim() || files.length || feeling || tagged.length || place);
  const close = () => { if (!edit && dirty && !window.confirm('Bỏ bài viết đang soạn?')) return; onClose(); };
  useEscClose(ov.id, close);
  useEffect(() => { if (pick) setTimeout(() => fileRef.current?.click(), 50); else if (view === 'main') setTimeout(() => areaRef.current?.focus(), 30); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  if (!me) return null;
  const add = async (fs: File[]) => { if (!fs.length) return; setBusy(true); const got = await readPostFiles(fs, notify); setFiles((p) => [...p, ...got].slice(0, 30)); setBusy(false); };
  const media = files.filter(isMedia), docsF = files.filter((f) => !isMedia(f));
  const options = opts.map((o) => o.trim()).filter(Boolean);
  const big = !files.length && kind !== 'POLL' && !sharing && text.length < 85;
  const can = !busy && (kind === 'POLL' ? options.length >= 2 : !!(text.trim() || files.length || sharing));
  const publish = () => {
    if (!can) return;
    const t = text.trim();
    const extra = { feeling, tagged: tagged.length ? tagged : undefined, place: place.trim() || undefined };
    if (edit) {
      setPosts((all) => all.map((p) => (p.id === edit.id ? { ...p, text: t, files: files.length ? files : undefined, ...extra, editedAt: Date.now() } : p)));
      notify('Đã cập nhật bài viết', 'teal'); onClose(); return;
    }
    const p: Post = { id: uid('ps'), kind, authorId: me.id, at: Date.now(), text: t, likes: [], ...(files.length ? { files } : {}), ...extra, ...(sharing ? { sharedId: sharing.sharedId ?? sharing.id } : {}),
      ...(kind === 'POLL' ? { poll: { options: options.map((o) => ({ id: uid('op'), text: o, votes: [] })), multi, ...(closes ? { closesAt: closes } : {}) } } : {}) };
    setPosts((all) => [p, ...all]);
    const mentions = [...new Set([...users.filter((u) => u.id !== me.id && t.includes(`@${u.name}`)).map((u) => u.id), ...tagged.filter((x) => x !== me.id)])];
    if (mentions.length) addComment({ entity: 'post', entityId: p.id, text: (t || (sharing ? 'đã chia sẻ một bài viết' : 'đã gắn thẻ bạn trong một bài viết')).slice(0, 300), mentions, module: 'home' }, tagged.length ? 'bài viết có gắn thẻ bạn' : `bài đăng ${POST_KIND[kind].label.toLowerCase()}`);
    notify(sharing ? 'Đã chia sẻ lên Bảng tin' : kind === 'ANNOUNCE' ? 'Đã đăng thông báo' : 'Đã đăng bài', 'teal');
    onClose();
  };
  const placeSugs = [...new Set([company.address ? `Văn phòng ${company.shortName || company.legalName}` : '', 'Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', ...posts.map((p) => p.place ?? '')].filter(Boolean))];
  const userList = users.filter((u) => u.active && u.id !== me.id && (!q || fold(u.name).includes(fold(q))));
  const back = (title: string) => (
    <header className="relative flex items-center justify-center border-b border-[rgb(var(--line))] px-12 py-3.5">
      <button className="absolute left-3 rounded-full bg-[rgb(var(--ink)/0.06)] p-2 hover:bg-[rgb(var(--ink)/0.1)]" onClick={() => { setView('main'); setQ(''); }} aria-label="Quay lại"><ArrowLeft className="h-5 w-5" /></button>
      <h2 className="text-lg font-bold">{title}</h2>
    </header>
  );
  const addBtn = (label: string, color: string, icon: typeof Wallet, run: () => void, on?: boolean) => {
    const I = icon;
    return <button type="button" onClick={run} title={label} aria-label={label} aria-pressed={on} className={cn('flex h-9 w-9 items-center justify-center rounded-full hover:bg-[rgb(var(--ink)/0.07)]', on && 'bg-[rgb(var(--ink)/0.07)]')}><I className="h-6 w-6" style={{ color }} aria-hidden /></button>;
  };
  return portal(
    <div className={cn('fixed inset-0 z-[66] flex items-end justify-center sm:items-center sm:p-4', !ov.top && 'invisible')} role="dialog" aria-modal="true" aria-label={edit ? 'Chỉnh sửa bài viết' : 'Tạo bài viết'}>
      <div className="absolute inset-0 bg-[rgb(var(--surface)/0.7)] backdrop-blur-[2px] motion-safe:animate-[fadeIn_.15s_ease-out] dark:bg-black/60" onClick={close} />
      <div className="relative flex max-h-[92vh] w-full flex-col rounded-t-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] shadow-2xl sm:max-w-[500px] sm:rounded-xl motion-safe:animate-[popIn_.18s_ease-out]"
        onDragOver={(e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); setDrag(true); } }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); void add([...e.dataTransfer.files]); }}>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip" className="sr-only" onChange={(e) => { void add([...(e.target.files ?? [])]); e.target.value = ''; }} />
        {view === 'main' && <>
          <header className="relative flex items-center justify-center border-b border-[rgb(var(--line))] px-12 py-3.5">
            <h2 className="text-lg font-bold">{edit ? 'Chỉnh sửa bài viết' : sharing ? 'Chia sẻ bài viết' : 'Tạo bài viết'}</h2>
            <button className="absolute right-3 rounded-full bg-[rgb(var(--ink)/0.06)] p-2 hover:bg-[rgb(var(--ink)/0.1)]" onClick={close} aria-label="Đóng"><X className="h-5 w-5" /></button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3">
            <div className="flex items-center gap-2.5">
              <PAvatar user={me} size={40} meId={me.id} />
              <div className="min-w-0">
                <PostHeadline p={{ id: 'x', kind, authorId: me.id, at: 0, text: '', likes: [], feeling, tagged, place: place.trim() || undefined }} name={<b className="font-semibold">{me.name}</b>} />
                {!edit && !sharing && kinds.length > 1 && (
                  <select className="mt-0.5 h-6 rounded-md border-0 bg-[rgb(var(--ink)/0.07)] py-0 pl-2 pr-6 text-xs font-semibold text-[rgb(var(--fg))]" value={kind} onChange={(e) => setKind(e.target.value as PostKind)} aria-label="Loại bài">
                    {kinds.map((k) => <option key={k} value={k}>{POST_KIND[k].label}</option>)}
                  </select>
                )}
              </div>
            </div>
            <textarea ref={areaRef} rows={big ? 4 : 3} value={text} onChange={(e) => setText(e.target.value)}
              onPaste={(e) => { const fs = [...e.clipboardData.files]; if (fs.length) { e.preventDefault(); void add(fs); } }}
              placeholder={sharing ? 'Hãy nói gì đó về nội dung này…' : kind === 'POLL' ? 'Đặt câu hỏi bình chọn…' : `${firstName(me.name)} ơi, bạn đang nghĩ gì thế?`}
              className={cn('mt-3 w-full resize-none border-0 bg-transparent p-0 text-[rgb(var(--fg))] placeholder:text-[rgb(var(--faint))] focus:outline-none focus:ring-0', big ? 'text-2xl' : 'text-[15px] leading-relaxed')} aria-label="Nội dung bài viết" />
            {kind === 'POLL' && !edit && (
              <div className="mb-3 space-y-2 rounded-lg border border-[rgb(var(--line))] p-3">
                {opts.map((o, i) => <input key={i} className={inputCls} placeholder={`Phương án ${i + 1}`} value={o} onChange={(e) => setOpts((p) => p.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Phương án ${i + 1}`} />)}
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {opts.length < 6 && <button className={cn(btnGhost, btnSm)} onClick={() => setOpts((p) => [...p, ''])}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm phương án</button>}
                  <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={multi} onChange={(e) => setMulti(e.target.checked)} />Cho chọn nhiều</label>
                  <label className="flex items-center gap-2">Kết thúc <input type="date" className={cn(inputBase, 'py-1')} value={closes} onChange={(e) => setCloses(e.target.value)} aria-label="Ngày kết thúc bình chọn" /></label>
                </div>
              </div>
            )}
            {(media.length > 0 || drag) && (
              <div className="relative mb-3 overflow-hidden rounded-lg border border-[rgb(var(--line))] p-1.5">
                {drag && <div className="absolute inset-0 z-10 flex items-center justify-center bg-[rgb(var(--surface)/0.9)] text-sm font-semibold">Thả ảnh / video vào đây</div>}
                <div className="grid grid-cols-3 gap-1.5">
                  {media.map((f) => (
                    <div key={f.url.slice(-40) + f.name} className="relative aspect-square overflow-hidden rounded-md bg-[rgb(var(--ink)/0.06)]">
                      {f.type.startsWith('video/') ? <video src={f.url} className="h-full w-full object-cover" muted /> : <img src={f.url} alt="" className="h-full w-full object-cover" />}
                      <button className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80" onClick={() => setFiles((p) => p.filter((x) => x !== f))} aria-label={`Bỏ ${f.name}`}><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => fileRef.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md bg-[rgb(var(--ink)/0.05)] text-xs font-medium text-[rgb(var(--muted))] hover:bg-[rgb(var(--ink)/0.09)]"><ImagePlus className="h-6 w-6" aria-hidden />Thêm ảnh/video</button>
                </div>
              </div>
            )}
            {docsF.length > 0 && <div className="mb-3 flex flex-wrap gap-1.5">{docsF.map((f) => <span key={f.name} className="flex items-center gap-1.5 rounded-md border border-[rgb(var(--line))] px-2 py-1 text-xs"><Paperclip className="h-3 w-3" aria-hidden />{f.name}<button onClick={() => setFiles((p) => p.filter((x) => x !== f))} aria-label={`Bỏ ${f.name}`}><X className="h-3 w-3" /></button></span>)}</div>}
            {sharing && <div className="mb-3"><SharedPostEmbed id={sharing.sharedId ?? sharing.id} /></div>}
            {busy && <p className="mb-2 text-xs text-[rgb(var(--muted))]">Đang xử lý ảnh…</p>}
          </div>
          <div className="px-4 pb-4 pt-1">
            <div className="mb-3 flex items-center gap-1 rounded-lg border border-[rgb(var(--line))] py-1.5 pl-3 pr-1.5 shadow-sm">
              <span className="flex-1 text-sm font-semibold">Thêm vào bài viết</span>
              {!sharing && addBtn('Ảnh/video', FB_ICON.photo, ImagePlus, () => fileRef.current?.click(), media.length > 0)}
              {addBtn('Gắn thẻ người khác', FB_ICON.tag, UserPlus, () => setView('tag'), tagged.length > 0)}
              {addBtn('Cảm xúc/hoạt động', FB_ICON.feel, SmilePlus, () => setView('feeling'), !!feeling)}
              {addBtn('Địa điểm', FB_ICON.place, MapPin, () => setView('place'), !!place)}
              {!edit && !sharing && canPoll && addBtn('Bình chọn', FB_ICON.poll, Vote, () => setKind(kind === 'POLL' ? 'POST' : 'POLL'), kind === 'POLL')}
              {!sharing && addBtn('Đính kèm tài liệu', FB_ICON.file, Paperclip, () => fileRef.current?.click(), docsF.length > 0)}
            </div>
            <button className={cn(btnPrimary, 'h-10 w-full justify-center text-[15px]')} disabled={!can} onClick={publish}>{edit ? 'Lưu' : sharing ? 'Chia sẻ ngay' : 'Đăng'}</button>
          </div>
        </>}
        {view === 'feeling' && <>
          {back('Bạn đang cảm thấy thế nào?')}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <input autoFocus className={cn(inputCls, 'mb-3 rounded-full')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm kiếm" aria-label="Tìm cảm xúc" />
            {feeling && <button className="mb-2 text-sm font-medium text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => { setFeeling(undefined); setView('main'); }}>Bỏ cảm xúc / hoạt động</button>}
            {(['feel', 'act'] as const).map((v) => { const list = FEELINGS.filter((x) => x.verb === v && (!q || fold(x.label).includes(fold(q)))); return list.length ? (
              <div key={v} className="mb-2">
                <p className="mb-1 px-1 text-xs font-semibold text-[rgb(var(--muted))]">{v === 'feel' ? 'Cảm xúc' : 'Hoạt động'}</p>
                <div className="grid grid-cols-2 gap-1">{list.map((x) => <button key={x.label} onClick={() => { setFeeling(x); setView('main'); setQ(''); }} className={cn('flex items-center gap-3 rounded-lg px-2 py-2 text-left text-[15px] hover:bg-[rgb(var(--ink)/0.06)]', feeling?.label === x.label && 'bg-[rgb(var(--ink)/0.06)]')}><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--ink)/0.06)] text-xl">{x.emoji}</span>{x.label}</button>)}</div>
              </div>
            ) : null; })}
          </div>
        </>}
        {view === 'tag' && <>
          {back('Gắn thẻ người khác')}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-3 flex items-center gap-2"><input autoFocus className={cn(inputCls, 'rounded-full')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm đồng nghiệp" aria-label="Tìm đồng nghiệp" /><button className={cn(btnPrimary, btnSm)} onClick={() => { setView('main'); setQ(''); }}>Xong</button></div>
            {tagged.length > 0 && <div className="mb-3 flex flex-wrap gap-1.5">{tagged.map((id) => <span key={id} className="flex items-center gap-1 rounded-full bg-[rgb(var(--secondary)/0.14)] px-2.5 py-1 text-sm text-[rgb(var(--secondary-fg))]">{users.find((u) => u.id === id)?.name}<button onClick={() => setTagged((p) => p.filter((x) => x !== id))} aria-label="Bỏ gắn thẻ"><X className="h-3.5 w-3.5" /></button></span>)}</div>}
            <ul>{userList.map((u) => { const on = tagged.includes(u.id); return (
              <li key={u.id}><button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[rgb(var(--ink)/0.06)]" onClick={() => setTagged((p) => (on ? p.filter((x) => x !== u.id) : [...p, u.id]))} aria-pressed={on}>
                <PAvatar user={u} size={36} meId={me.id} /><span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium">{u.name}</span><span className="block truncate text-xs text-[rgb(var(--muted))]">{u.title || ROLE_LABEL[u.role]}</span></span>
                <span className={cn('flex h-5 w-5 items-center justify-center rounded border text-xs', on ? 'border-[rgb(var(--secondary))] bg-[rgb(var(--secondary))] text-white' : 'border-[rgb(var(--line))]')}>{on ? '✓' : ''}</span>
              </button></li>
            ); })}</ul>
          </div>
        </>}
        {view === 'place' && <>
          {back('Bạn đang ở đâu?')}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setView('main'); }}><input autoFocus className={cn(inputCls, 'rounded-full')} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Nhập địa điểm, VD: Công trình Vinhomes Ocean Park" aria-label="Địa điểm" /><button className={cn(btnPrimary, btnSm)}>Xong</button></form>
            {place && <button className="mb-2 text-sm font-medium text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => { setPlace(''); setView('main'); }}>Bỏ địa điểm</button>}
            <ul>{placeSugs.filter((x) => !place || fold(x).includes(fold(place))).slice(0, 8).map((x) => <li key={x}><button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[15px] hover:bg-[rgb(var(--ink)/0.06)]" onClick={() => { setPlace(x); setView('main'); }}><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgb(var(--ink)/0.06)]"><MapPin className="h-5 w-5" style={{ color: FB_ICON.place }} aria-hidden /></span>{x}</button></li>)}</ul>
          </div>
        </>}
      </div>
    </div>,
  );
}

/** Bài gốc được chia sẻ (kèm ảnh) hiển thị lồng trong bài chia sẻ */
export function SharedPostEmbed({ id }: { id: string }) {
  const { posts, users, userName, me } = useApp();
  const [view, setView] = useState<number | null>(null);
  const o = posts.find((x) => x.id === id);
  if (!o || (o.hidden && o.authorId !== me?.id)) return <div className="rounded-lg border border-[rgb(var(--line))] p-4 text-sm text-[rgb(var(--muted))]"><b className="block text-[rgb(var(--fg))]">Nội dung này hiện không hiển thị</b>Bài viết gốc đã bị xóa hoặc ẩn.</div>;
  const media = (o.files ?? []).filter(isMedia);
  return (
    <div className="overflow-hidden rounded-lg border border-[rgb(var(--line))]">
      {media.length > 0 && <PhotoGrid files={media} onOpen={setView} />}
      <div className="p-3">
        <div className="flex items-center gap-2"><PAvatar user={users.find((u) => u.id === o.authorId)} name={userName(o.authorId)} size={32} meId={me?.id} /><div className="min-w-0"><PostHeadline p={o} name={<b className="font-semibold">{userName(o.authorId)}</b>} /><p className="text-xs text-[rgb(var(--muted))]">{fbTime(o.at)}</p></div></div>
        {o.text && <p className="mt-2 line-clamp-4 whitespace-pre-wrap break-words text-[15px] text-[rgb(var(--fg2))]"><MentionText text={o.text} /></p>}
      </div>
      {view !== null && <PhotoViewer files={media} start={view} onClose={() => setView(null)} />}
    </div>
  );
}

export function usePostSeen(ref: { current: HTMLElement | null }, p: Post, meId: string | undefined, onSeen: () => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !meId || p.authorId === meId || p.views?.includes(meId) || seenThisSession.has(p.id) || typeof IntersectionObserver === 'undefined') return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) t = setTimeout(() => { seenThisSession.add(p.id); onSeen(); io.disconnect(); }, 1000);
      else if (t) clearTimeout(t);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => { io.disconnect(); if (t) clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id, meId]);
}

/** Một bài trên bảng tin, bố cục Facebook */
export function FeedPostCard({ p, hot, saved, onSave, onEdit, onShare, onConfirm }: { p: Post; hot: boolean; saved: boolean; onSave: () => void; onEdit: () => void; onShare: (p: Post) => void; onConfirm: (c: ConfirmState) => void }) {
  const { me, users, userName, posts, setPosts, comments, addComment, canDo, notify, departments } = useApp();
  const ref = useRef<HTMLElement>(null);
  const [view, setView] = useState<number | null>(null);
  const [more, setMore] = useState(false);
  const [openCm, setOpenCm] = useState(false);
  const [sum, setSum] = useState(false);
  const [pick, setPick] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const pickT = useRef<ReturnType<typeof setTimeout>>();
  const shareRef = useOutsideClose(shareOpen, () => setShareOpen(false));
  const patch = (fn: (x: Post) => Post) => setPosts((all) => all.map((x) => (x.id === p.id ? fn(x) : x)));
  usePostSeen(ref, p, me?.id, () => me && patch((x) => (x.views?.includes(me.id) ? x : { ...x, views: [...(x.views ?? []), me.id] })));
  if (!me) return null;
  const au = users.find((u) => u.id === p.authorId) ?? (p.authorId === me.id ? me : undefined);
  const cms = comments.filter((c) => c.entity === 'post' && c.entityId === p.id && !(c.authorId === p.authorId && c.at - p.at < 2000)).sort((a, b) => a.at - b.at);
  const mine = p.authorId === me.id;
  const mod = canDo('feed.moderate');
  const media = (p.files ?? []).filter(isMedia), docsF = (p.files ?? []).filter((f) => !isMedia(f));
  const my = reactOf(p, me.id);
  const R = REACTS.find((r) => r.id === my);
  const total = reactTotal(p);
  const tops = REACTS.map((r) => ({ r, n: r.id === 'like' ? p.likes.length : (p.reacts?.[r.id]?.length ?? 0) })).filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 3);
  const shares = posts.filter((x) => x.sharedId === p.id).length;
  const long = p.text.length > 280 || p.text.split('\n').length > 6;
  const bigText = !media.length && !p.poll && !p.sharedId && p.text.length < 85 && !p.text.includes('\n');
  const K = POST_KIND[p.kind];
  const pollTotal = p.poll ? new Set(p.poll.options.flatMap((o) => o.votes)).size : 0;
  const closed = !!p.poll?.closesAt && p.poll.closesAt < new Date().toISOString().slice(0, 10);
  const vote = (oid: string) => {
    if (!p.poll || closed) return;
    patch((x) => ({ ...x, poll: { ...x.poll!, options: x.poll!.options.map((o) => { const has = o.votes.includes(me.id); if (o.id === oid) return { ...o, votes: has ? o.votes.filter((v) => v !== me.id) : [...o.votes, me.id] }; return x.poll!.multi ? o : { ...o, votes: o.votes.filter((v) => v !== me.id) }; }) } }));
  };
  const react = (r: ReactId | null) => { patch((x) => withReact(x, me.id, r)); setPick(false); };
  const shareOut = async () => {
    setShareOpen(false);
    const src = p.sharedId ? posts.find((x) => x.id === p.sharedId) ?? p : p;
    const imgs = (src.files ?? []).filter((f) => f.type.startsWith('image/')).slice(0, 10);
    const txt = [src.text, `— ${userName(src.authorId)}`].filter(Boolean).join('\n');
    try {
      const fs = await Promise.all(imgs.map(async (f, i) => new File([await (await fetch(f.url)).blob()], f.name || `anh-${i + 1}.jpg`, { type: f.type })));
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && (!fs.length || nav.canShare?.({ files: fs }))) { await nav.share({ text: txt, ...(fs.length ? { files: fs } : {}) }); return; }
    } catch (e) { if (e instanceof DOMException && e.name === 'AbortError') return; }
    await navigator.clipboard?.writeText(txt).catch(() => undefined);
    imgs.forEach((f, i) => setTimeout(() => { const a = document.createElement('a'); a.href = f.url; a.download = f.name || `anh-${i + 1}.jpg`; a.click(); }, i * 250));
    notify(imgs.length ? `Đã chép nội dung và tải ${imgs.length} ảnh về máy, dán vào Zalo / Facebook để chia sẻ` : 'Đã chép nội dung, dán vào Zalo / Facebook để chia sẻ', 'teal');
  };
  const actBtn = 'flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-[15px] font-medium text-[rgb(var(--muted))] transition-colors hover:bg-[rgb(var(--ink)/0.06)]';
  return (
    <article ref={ref} id={`post-${p.id}`} className={cn('scroll-mt-24 overflow-hidden rounded-lg border bg-[rgb(var(--surface))] shadow-sm transition-shadow', hot ? 'border-[rgb(var(--accent))] ring-2 ring-[rgb(var(--accent)/0.35)]' : 'border-[rgb(var(--line))]', p.hidden && 'opacity-60')}>
      <header className="flex items-start gap-2.5 px-4 pt-3">
        <PAvatar user={au} name={userName(p.authorId)} size={40} meId={me.id} />
        <div className="min-w-0 flex-1">
          <PostHeadline p={p} name={<b className="font-semibold">{mine ? me.name : userName(p.authorId)}</b>} />
          <p className="flex flex-wrap items-center gap-x-1 text-[13px] text-[rgb(var(--muted))]">
            <span title={new Date(p.at).toLocaleString('vi-VN')}>{fbTime(p.at)}</span>{p.editedAt ? <span>· đã sửa</span> : null}
            <span aria-hidden>·</span><span title={`${K.label} · Toàn công ty`} className="inline-flex items-center gap-1">{p.kind === 'POST' ? <Globe className="h-3 w-3" aria-hidden /> : <><K.icon className="h-3 w-3" aria-hidden />{K.label}</>}</span>
            {au?.dept && <span className="hidden sm:inline">· {departments.find((d) => d.code === au.dept)?.short ?? ''}</span>}
            {p.pinned && <span className="inline-flex items-center gap-0.5 text-[rgb(var(--accent-fg))]">· <Pin className="h-3 w-3" aria-hidden />Đã ghim</span>}
            {p.hidden && <span>· Đã ẩn</span>}
          </p>
        </div>
        <RowMenu label={`Thao tác bài của ${userName(p.authorId)}`} items={[
          { label: saved ? 'Bỏ lưu bài viết' : 'Lưu bài viết', icon: Bookmark, onClick: onSave },
          ...(long ? [{ label: sum ? 'Ẩn tóm tắt' : 'Tóm tắt nhanh', icon: Sparkles, onClick: () => setSum((v) => !v) }] : []),
          ...(mine ? [{ label: 'Chỉnh sửa bài viết', icon: Pencil, onClick: onEdit }] : []),
          ...(mod ? [{ label: p.pinned ? 'Bỏ ghim' : 'Ghim lên đầu', icon: Pin, onClick: () => patch((x) => ({ ...x, pinned: x.pinned ? undefined : { by: me.id, at: Date.now() } })) }] : []),
          ...(mod ? [{ label: p.hidden ? 'Hiện lại' : 'Ẩn khỏi bảng tin', icon: EyeOff, onClick: () => patch((x) => ({ ...x, hidden: x.hidden ? undefined : { by: me.id, at: Date.now() } })) }] : []),
          ...(mine || mod ? [{ label: 'Xóa bài viết', icon: Trash2, danger: true, onClick: () => onConfirm({ title: 'Xóa bài viết', message: 'Xóa bài viết này khỏi bảng tin?', confirmLabel: 'Xóa', onConfirm: () => removeWithUndo(setPosts, p, notify, 'Đã xóa bài viết') }) }] : []),
        ]} />
      </header>
      {sum && <p className="mx-4 mt-2 rounded-md bg-[rgb(var(--secondary)/0.08)] px-3 py-2 text-sm text-[rgb(var(--fg2))]">{summarizeText(p.text)}</p>}
      {p.text && (
        <div className={cn('px-4 pt-2 whitespace-pre-wrap break-words text-[rgb(var(--fg))]', bigText ? 'text-2xl leading-snug' : 'text-[15px] leading-relaxed')}>
          <span className={cn(long && !more && 'line-clamp-5')}><MentionText text={p.text} /></span>
          {long && !more && <button className="font-semibold text-[rgb(var(--fg))] hover:underline" onClick={() => setMore(true)}>Xem thêm</button>}
        </div>
      )}
      {p.poll && (
        <div className="space-y-2 px-4 pt-3" role="group" aria-label="Phương án bình chọn">
          {p.poll.options.map((o) => { const n = o.votes.length; const pc = pollTotal ? Math.round((n / pollTotal) * 100) : 0; const on = o.votes.includes(me.id); return (
            <button key={o.id} disabled={closed} onClick={() => vote(o.id)} aria-pressed={on} className={cn('relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm disabled:cursor-default', on ? 'border-[rgb(var(--secondary))]' : 'border-[rgb(var(--line))] hover:border-[rgb(var(--secondary)/0.6)]')}>
              <span className="absolute inset-y-0 left-0 bg-[rgb(var(--secondary)/0.14)]" style={{ width: `${pc}%` }} aria-hidden />
              <span className="relative flex items-center gap-2"><span className={cn('flex h-4 w-4 shrink-0 items-center justify-center border text-[10px]', p.poll!.multi ? 'rounded-sm' : 'rounded-full', on ? 'border-[rgb(var(--secondary))] bg-[rgb(var(--secondary))] text-white' : 'border-[rgb(var(--line))]')}>{on ? '✓' : ''}</span><span className="flex-1">{o.text}</span><span className="tabular-nums text-[rgb(var(--muted))]">{pc}%</span></span>
            </button>
          ); })}
          <p className="text-xs text-[rgb(var(--muted))]">{pollTotal} người đã bình chọn{p.poll.multi ? ' · chọn nhiều phương án' : ''}{p.poll.closesAt ? ` · ${closed ? 'đã kết thúc' : 'kết thúc'} ${fmtDate(p.poll.closesAt)}` : ''}</p>
        </div>
      )}
      {p.sharedId && <div className="px-4 pt-3"><SharedPostEmbed id={p.sharedId} /></div>}
      {media.length > 0 && <div className="mt-3"><PhotoGrid files={media} onOpen={setView} /></div>}
      {docsF.length > 0 && <div className="px-4 pt-3"><ChatFiles files={docsF} /></div>}
      <footer className="mt-2 flex items-center gap-1 border-t border-[rgb(var(--ink)/0.06)] px-2 py-1">
        <div className="relative" onMouseEnter={() => { clearTimeout(pickT.current); pickT.current = setTimeout(() => setPick(true), 450); }} onMouseLeave={() => { clearTimeout(pickT.current); pickT.current = setTimeout(() => setPick(false), 300); }}>
          {pick && (
            <div className="absolute bottom-full left-0 z-20 mb-1 flex gap-0.5 rounded-full border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-1.5 py-1 shadow-xl" role="group" aria-label="Bày tỏ cảm xúc">
              {REACTS.map((r) => <button key={r.id} onClick={() => react(my === r.id ? null : r.id)} title={r.label} aria-label={r.label} aria-pressed={my === r.id} className="flex h-10 w-10 items-center justify-center rounded-full text-[26px] transition-transform hover:-translate-y-1 hover:scale-125">{r.emoji}</button>)}
            </div>
          )}
          <button className={actBtn} style={R ? { color: R.color } : undefined} onClick={() => react(my ? null : 'like')} aria-pressed={!!my} aria-label={R ? `Đã ${R.label}, bấm để bỏ` : 'Thích'}>
            {R && R.id !== 'like' ? <span className="text-lg leading-none">{R.emoji}</span> : <ThumbsUp className="h-5 w-5" aria-hidden />}
            {total > 0 && <span className="tabular-nums">{total}</span>}
            {tops.length > 1 && <span className="ml-0.5 flex -space-x-1 text-sm">{tops.map((x) => <span key={x.r.id}>{x.r.emoji}</span>)}</span>}
          </button>
        </div>
        <button className={actBtn} onClick={() => setOpenCm((v) => !v)} aria-expanded={openCm} aria-label="Bình luận"><MessageCircle className="h-5 w-5" aria-hidden />{cms.length > 0 && <span className="tabular-nums">{cms.length}</span>}</button>
        <div className="relative" ref={shareRef}>
          <button className={actBtn} onClick={() => setShareOpen((v) => !v)} aria-haspopup="menu" aria-expanded={shareOpen} aria-label="Chia sẻ"><Share2 className="h-5 w-5" aria-hidden />{shares > 0 && <span className="tabular-nums">{shares}</span>}</button>
          {shareOpen && (
            <ul role="menu" className="absolute bottom-full left-0 z-20 mb-1 w-64 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] py-1 shadow-xl">
              {[
                { l: 'Chia sẻ ngay lên Bảng tin', I: Share2, run: () => { const src = p.sharedId ?? p.id; setPosts((all) => [{ id: uid('ps'), kind: 'POST', authorId: me.id, at: Date.now(), text: '', likes: [], sharedId: src }, ...all]); notify('Đã chia sẻ lên Bảng tin', 'teal'); setShareOpen(false); } },
                { l: 'Chia sẻ kèm cảm nghĩ', I: PenLine, run: () => { setShareOpen(false); onShare(p); } },
                { l: 'Chia sẻ ra Zalo / Facebook (kèm ảnh)', I: ExternalLink, run: () => void shareOut() },
                { l: 'Sao chép nội dung', I: Copy, run: () => { setShareOpen(false); void navigator.clipboard?.writeText(p.text).then(() => notify('Đã sao chép', 'teal')); } },
              ].map((x) => <li key={x.l} role="none"><button role="menuitem" className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-[rgb(var(--ink)/0.05)]" onClick={x.run}><x.I className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />{x.l}</button></li>)}
            </ul>
          )}
        </div>
        <span className="ml-auto flex items-center gap-1.5 px-2 text-sm text-[rgb(var(--muted))]" title={`${p.views?.length ?? 0} người đã xem`}><Eye className="h-4 w-4" aria-hidden /><span className="tabular-nums">{p.views?.length ?? 0}</span></span>
      </footer>
      {openCm && (
        <div className="space-y-3 border-t border-[rgb(var(--ink)/0.06)] px-4 py-3">
          {cms.map((c) => (
            <div key={c.id} className="flex gap-2"><PAvatar user={users.find((u) => u.id === c.authorId)} name={userName(c.authorId)} size={32} meId={me.id} />
              <div className="min-w-0"><div className="rounded-2xl bg-[rgb(var(--ink)/0.05)] px-3 py-2"><p className="text-[13px] font-semibold">{userName(c.authorId)}</p><p className="whitespace-pre-wrap break-words text-[15px]"><MentionText text={c.text} /></p></div><p className="mt-0.5 px-3 text-xs text-[rgb(var(--muted))]">{fbTime(c.at)}</p>{c.files?.length ? <div className="mt-1"><ChatFiles files={c.files} /></div> : null}</div>
            </div>
          ))}
          <div className="flex gap-2"><PAvatar user={me} size={32} meId={me.id} /><div className="min-w-0 flex-1"><MentionComposer rows={1} placeholder={`Bình luận dưới tên ${me.name}…`} onSend={(t2, m) => addComment({ entity: 'post', entityId: p.id, text: t2, mentions: [...new Set([...m, ...(p.authorId !== me.id ? [p.authorId] : [])])], module: 'home' }, 'bình luận bài viết')} /></div></div>
        </div>
      )}
      {view !== null && <PhotoViewer files={media} start={view} onClose={() => setView(null)} />}
    </article>
  );
}

export function HomePage() {
  const app = useApp();
  const { me, users, userName, posts, canDo, canSee, notify, company, myLeads, jobs, installJobs, docs, go, presetQuery, org, quotes, receipts } = app;
  const [filter, setFilter] = useSticky<'ALL' | PostKind | 'BIZ' | 'SAVED'>('HomePage.filter', 'ALL');
  const [tag, setTag] = useSticky<string>('HomePage.tag', '');
  const [compose, setCompose] = useState<{ start?: 'main' | 'feeling' | 'tag' | 'place' | 'poll'; pick?: boolean; edit?: Post; sharing?: Post } | null>(presetQuery === 'compose' ? {} : null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const savedKey = `3a:saved-posts:${org.id}:${me?.id ?? 'x'}`;
  const [saved, setSaved] = useState<string[]>(() => { try { const v = JSON.parse(localStorage.getItem(savedKey) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; } });
  const taskN = useTaskCount();
  const [hot, setHot] = useState<string | null>(null);
  const focusPost = (id: string) => { setFilter('ALL'); setTag(''); setHot(id); setTimeout(() => document.getElementById(`post-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60); setTimeout(() => setHot(null), 2500); };
  useEffect(() => { const f = (e: Event) => focusPost(String((e as CustomEvent<string>).detail)); window.addEventListener(HOME_FOCUS_EVT, f); return () => window.removeEventListener(HOME_FOCUS_EVT, f); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (presetQuery === 'compose') setCompose({}); }, [presetQuery]);
  if (!me) return null;
  const mod = canDo('feed.moderate');
  const canPoll = canDo('feed.poll');
  const mfg = bizMode(company) === 'MFG';
  const now = Date.now();
  const toggleSave = (id: string) => setSaved((p) => { const n = p.includes(id) ? p.filter((x) => x !== id) : [...p, id]; try { localStorage.setItem(savedKey, JSON.stringify(n)); } catch { /* bỏ qua */ } notify(n.includes(id) ? 'Đã lưu bài viết' : 'Đã bỏ lưu', 'teal'); return n; });
  const tagsOf = (t: string) => (t.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((x) => x.toLowerCase());

  // Hoạt động kinh doanh tự động (đọc từ dữ liệu, không lưu thêm)
  const since = now - 30 * 864e5;
  const auto: FeedAuto[] = [];
  if (canSee('projects') || canSee('leads')) myLeads.filter((l) => l.wonAt && Date.parse(l.wonAt) > since).forEach((l) => auto.push({ id: `won-${l.id}`, at: Date.parse(l.wonAt!), icon: Trophy, tone: 'teal', text: <><b>{userName(l.assignee) || 'Phòng kinh doanh'}</b> chốt đơn <b>{l.company}</b>{l.wonAmount ? <> · {compact(l.wonAmount)}</> : null}</>, open: () => go('projects', l.code) }));
  if (canSee('jobs')) jobs.filter((j) => j.wonAt && Date.parse(j.wonAt) > since).forEach((j) => auto.push({ id: `jw-${j.id}`, at: Date.parse(j.wonAt!), icon: Trophy, tone: 'teal', text: <><b>{userName(j.ownerId) || 'Kỹ thuật'}</b> chốt đơn <b>{j.code}</b> · {j.title}{jobMoney(j, receipts).value ? <> · {compact(jobMoney(j, receipts).value)}</> : null}</>, open: () => go('jobs', j.code) }));
  if (canSee('install')) installJobs.filter((i) => i.acceptance && Date.parse(i.acceptance.at) > since).forEach((i) => auto.push({ id: `ia-${i.id}`, at: Date.parse(i.acceptance!.at), icon: CheckCircle2, tone: 'blue', text: <>Nghiệm thu bàn giao <b>{i.code}</b> · {i.title}</>, open: () => go('install') }));
  if (canSee('docs')) docs.filter((d) => canViewDoc(d, me) && Date.parse(d.updatedAt) > since).forEach((d) => auto.push({ id: `doc-${d.id}`, at: Date.parse(d.updatedAt), icon: FolderOpen, tone: 'muted', text: <>Tài liệu cập nhật <b>{d.title}</b> · bản {d.version}</>, open: () => go('docs', d.title) }));
  auto.sort((a, b) => b.at - a.at);

  const visible = posts.filter((p) => !p.hidden || mod || p.authorId === me.id);
  const allTags = Array.from(visible.reduce((m, p) => { tagsOf(p.text).forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)); return m; }, new Map<string, number>())).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const shown = visible.filter((p) => filter === 'ALL' || (filter === 'SAVED' ? saved.includes(p.id) : p.kind === filter)).filter((p) => !tag || tagsOf(p.text).includes(tag)).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.at - a.at);
  type Row = { t: 'post'; p: Post; at: number } | { t: 'auto'; a: FeedAuto; at: number };
  const rows: Row[] = filter === 'BIZ' ? auto.map((a) => ({ t: 'auto' as const, a, at: a.at }))
    : [...shown.map((p) => ({ t: 'post' as const, p, at: p.pinned ? Infinity : p.at })), ...(filter === 'ALL' && !tag ? auto.slice(0, 8).map((a) => ({ t: 'auto' as const, a, at: a.at })) : [])].sort((a, b) => b.at - a.at);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const upcoming = users.filter((u) => u.active && u.birthday).map((u) => {
    const d = new Date(); const [, mm, dd] = u.birthday!.split('-').map(Number);
    let next = new Date(d.getFullYear(), mm - 1, dd); if (next.getTime() < new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) next = new Date(d.getFullYear() + 1, mm - 1, dd);
    return { u, days: Math.round((next.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 864e5) };
  }).filter((x) => x.days <= 7).sort((a, b) => a.days - b.days);
  const myQuotes = quotes.filter((q) => q.createdBy === me.id && (q.createdAt ?? Date.parse(q.date)) >= monthStart);
  const myWon = mfg ? jobs.filter((j) => j.ownerId === me.id && j.wonAt && Date.parse(j.wonAt) >= monthStart).reduce((a, j) => a + jobMoney(j, receipts).value, 0)
    : myLeads.filter((l) => l.assignee === me.id && l.wonAt && Date.parse(l.wonAt) >= monthStart).reduce((a, l) => a + (l.wonAmount ?? boqTotal(l)), 0);
  const leads7 = myLeads.filter((l) => +leadDate(l) >= now - 7 * 864e5).length;
  const navItems: { id: typeof filter; label: string; icon: typeof Wallet; n?: number }[] = [
    { id: 'ALL', label: 'Bảng tin', icon: House },
    { id: 'ANNOUNCE', label: 'Thông báo', icon: Megaphone, n: visible.filter((p) => p.kind === 'ANNOUNCE').length },
    { id: 'POST', label: 'Tin tức & chia sẻ', icon: Newspaper, n: visible.filter((p) => p.kind === 'POST').length },
    { id: 'IDEA', label: 'Sáng kiến', icon: Lightbulb, n: visible.filter((p) => p.kind === 'IDEA').length },
    { id: 'POLL', label: 'Bình chọn', icon: Vote, n: visible.filter((p) => p.kind === 'POLL').length },
    { id: 'BIZ', label: 'Hoạt động kinh doanh', icon: Trophy, n: auto.length },
    { id: 'SAVED', label: 'Đã lưu', icon: Bookmark, n: saved.filter((id) => visible.some((p) => p.id === id)).length },
  ];
  const tile = (n: ReactNode, label: string, run: () => void) => <button className="min-w-0 rounded-md bg-[rgb(var(--ink)/0.04)] p-3 text-left hover:bg-[rgb(var(--ink)/0.07)]" onClick={run}><p className="truncate font-display text-xl font-bold tabular-nums">{n}</p><p className="truncate text-xs text-[rgb(var(--muted))]">{label}</p></button>;
  const quick = (label: string, color: string, icon: typeof Wallet, run: () => void) => { const I = icon; return <button className="flex h-10 items-center justify-center gap-2 rounded-md text-[15px] font-medium text-[rgb(var(--muted))] hover:bg-[rgb(var(--ink)/0.05)]" onClick={run}><I className="h-6 w-6" style={{ color }} aria-hidden /><span className="truncate">{label}</span></button>; };
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr] xl:grid-cols-[220px_1fr_320px] 2xl:grid-cols-[240px_1fr_360px]">
      {/* Trái: điều hướng bảng tin + sinh nhật */}
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label="Bảng tin">
          {navItems.map((n) => (
            <button key={n.id} className={cn('flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors', filter === n.id && !tag ? 'bg-[rgb(var(--secondary)/0.12)] font-semibold text-[rgb(var(--secondary-fg))]' : 'text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.05)]')} onClick={() => { setFilter(n.id); setTag(''); }} aria-current={filter === n.id && !tag ? 'page' : undefined}>
              <n.icon className="h-4 w-4" aria-hidden /><span className="flex-1 whitespace-nowrap">{n.label}</span>{n.n ? <span className="text-xs tabular-nums text-[rgb(var(--muted))]">{n.n}</span> : null}
            </button>
          ))}
        </nav>
        <div className="hidden lg:block">
          <WidgetCard title={<span className="flex items-center gap-2"><Cake className="h-4 w-4 text-[rgb(var(--accent))]" aria-hidden />Sinh nhật</span>} period="7 ngày tới">
            {upcoming.length ? <ul className="space-y-2">{upcoming.map((x) => <li key={x.u.id} className="flex items-center gap-2.5 text-sm"><PAvatar user={x.u} size={28} meId={me.id} /><span className="min-w-0 flex-1"><span className="block truncate" title={x.u.name}>{x.u.name}</span><span className="text-xs text-[rgb(var(--muted))]">{x.days === 0 ? 'Hôm nay 🎂' : x.days === 1 ? 'Ngày mai' : `${x.days} ngày nữa`}{x.days === 0 && x.u.id !== me.id && <> · <button className="font-medium text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => go('messages', dmId(me.id, x.u.id))}>Chúc mừng</button></>}</span></span></li>)}</ul>
              : <p className="text-xs text-[rgb(var(--muted))]">Không có sinh nhật trong 7 ngày tới. Thêm ngày sinh ở Cài đặt › Nhân sự.</p>}
          </WidgetCard>
          {allTags.length > 0 && <div className="mt-4"><p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--faint))]">Hashtag</p>{allTags.map(([t, n]) => <button key={t} className={cn('block w-full rounded px-3 py-1 text-left text-sm text-[rgb(var(--secondary-fg))] hover:bg-[rgb(var(--ink)/0.05)]', tag === t && 'font-semibold')} onClick={() => setTag(tag === t ? '' : t)}>{t} <span className="text-xs text-[rgb(var(--muted))]">{n}</span></button>)}</div>}
        </div>
      </aside>

      {/* Giữa: soạn bài + bảng tin */}
      <div className="mx-auto w-full min-w-0 max-w-[680px] space-y-4">
        <div className="lg:hidden"><AssistantCommandBar onPost={focusPost} /></div>
        <section className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-4 pb-2 pt-3 shadow-sm" aria-label="Tạo bài viết">
          <div className="flex items-center gap-2.5">
            <PAvatar user={me} size={40} meId={me.id} />
            <button className="h-10 min-w-0 flex-1 truncate rounded-full bg-[rgb(var(--ink)/0.05)] px-4 text-left text-[15px] text-[rgb(var(--muted))] transition-colors hover:bg-[rgb(var(--ink)/0.08)]" onClick={() => setCompose({})}>{firstName(me.name)} ơi, bạn đang nghĩ gì thế?</button>
          </div>
          <div className="mt-3 grid grid-cols-3 border-t border-[rgb(var(--ink)/0.07)] pt-2">
            {quick('Ảnh/video', FB_ICON.photo, ImagePlus, () => setCompose({ pick: true }))}
            {quick('Cảm xúc/hoạt động', FB_ICON.feel, SmilePlus, () => setCompose({ start: 'feeling' }))}
            {canPoll ? quick('Bình chọn', FB_ICON.poll, Vote, () => setCompose({ start: 'poll' })) : quick('Gắn thẻ', FB_ICON.tag, UserPlus, () => setCompose({ start: 'tag' }))}
          </div>
        </section>
        {tag && <p className="flex items-center gap-2 text-sm">Đang lọc <Chip tone="blue">{tag}</Chip><button className="text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => setTag('')}>Bỏ lọc</button></p>}
        {rows.length ? rows.map((r) => r.t === 'post'
          ? <FeedPostCard key={r.p.id} p={r.p} hot={hot === r.p.id} saved={saved.includes(r.p.id)} onSave={() => toggleSave(r.p.id)} onEdit={() => setCompose({ edit: r.p })} onShare={(p) => setCompose({ sharing: p })} onConfirm={setConfirm} />
          : (
            <button key={r.a.id} onClick={r.a.open} className="flex w-full items-center gap-3 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-4 py-3 text-left text-sm shadow-sm transition-colors hover:border-[rgb(var(--secondary)/0.5)]">
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', r.a.tone === 'teal' ? 'bg-[rgb(var(--success)/0.15)] text-[rgb(var(--success-fg))]' : r.a.tone === 'blue' ? 'bg-[rgb(var(--secondary)/0.15)] text-[rgb(var(--secondary-fg))]' : 'bg-[rgb(var(--ink)/0.06)] text-[rgb(var(--muted))]')}><r.a.icon className="h-4 w-4" aria-hidden /></span>
              <span className="min-w-0 flex-1 text-[rgb(var(--fg2))]">{r.a.text}</span>
              <span className="shrink-0 text-xs text-[rgb(var(--muted))]">{fbTime(r.a.at)}</span>
            </button>
          )) : <EmptyState art="inbox" text={filter === 'SAVED' ? 'Chưa lưu bài viết nào' : filter === 'BIZ' ? 'Chưa có hoạt động kinh doanh trong 30 ngày' : 'Bảng tin còn trống'} hint={filter === 'ALL' ? 'Hãy là người đầu tiên chia sẻ với đồng nghiệp.' : undefined} />}
      </div>

      {/* Phải: việc của tôi, truyền thông */}
      <aside className="space-y-4 lg:col-span-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0 xl:sticky xl:top-20 xl:col-span-1 xl:block xl:space-y-4 xl:self-start">
        <WidgetCard title="Việc của tôi" period="Tháng này">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {tile(taskN, 'Việc chờ xử lý', () => go('tasks'))}
            {canSee('leads') && tile(leads7, 'Lead mới 7 ngày', () => go('leads'))}
            {!mfg && tile(myQuotes.length, 'Báo giá đã tạo', () => go('docs'))}
            {tile(compact(myWon), 'Doanh số đã chốt', () => go(mfg ? 'jobs' : 'projects'))}
          </div>
        </WidgetCard>
        <SocialHubWidget />
      </aside>
      {compose && <PostComposer {...compose} onClose={() => setCompose(null)} />}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

