'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Briefcase, CalendarDays, Camera, Coins, FileCheck2, Inbox, Megaphone, MessageCircle, Package, Plus, Ruler, Search, Ship, Sparkles, Target, Users } from 'lucide-react';
import { RowMenu } from './controls';
import { decideDept } from '../lib/business';
import { bizMode, canSeeConv, fmtDate, fmtN, fold, jobCustName, LEAD_STATUS, looksLikeQuestion, MODULE_DESC, MODULE_ICON, MODULE_LABEL, MODULE_SHORT, MODULES, NL_CREATE, NL_GO, SKU_FILTER0, stickyStore, useApp } from '../lib/core';
import type { Lead, Module, PaletteItem } from '../lib/types';
import { cn } from '../lib/utils';
import { useAi } from '../modules/ai/ai-core';
import { VisualSearchPanel } from '../modules/ai/visual-search';

/** Mở form tạo mới của một phân hệ khi được gọi từ Spotlight (lệnh "> Tạo PO mới"...) */
export function useIntent(key: string, fn: () => void) {
  const { intent, setIntent } = useApp();
  useEffect(() => {
    if (intent !== key) return;
    setIntent(null);
    fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent]);
}

/**
 * Spotlight (Ctrl/⌘ + K): thanh tìm kiếm kính mờ giữa màn hình + Command Palette.
 * - Gõ bình thường: tìm khách hàng, lead / dự án, chương trình quỹ, claim và lệnh.
 * - Gõ ">" ở đầu: chỉ hiện lệnh (tạo mới, chuyển trang, chuyển doanh nghiệp...). Không dấu vẫn khớp.
 */
/** Danh sách lệnh dùng chung cho Spotlight và AI Copilot */
export function useCommandItems(extra: PaletteItem[] = []): PaletteItem[] {
  const { canSee, canDo, go, openCustomerForm, openProgramForm, openLeadForm, setIntent, company } = useApp();
  const mfg = bizMode(company) === 'MFG';
  const open = (m: Module, intent: string) => () => { go(m); setTimeout(() => setIntent(intent), 0); };

  return [
    ...(canDo('lead.create') ? [{ id: 'a-lead', group: 'Lệnh tạo mới', label: 'Tạo lead mới', icon: Plus, run: () => (mfg ? open('leads', 'job.create')() : openLeadForm()), keys: 'them lead' }] : []),
    ...(canDo('project.update') && !mfg ? [{ id: 'a-proj', group: 'Lệnh tạo mới', label: 'Tạo dự án mới', icon: Target, run: () => openLeadForm(true) }] : []),
    ...(canDo('customer.edit') ? [{ id: 'a-cust', group: 'Lệnh tạo mới', label: 'Thêm khách hàng', icon: Users, run: () => openCustomerForm() }] : []),
    ...(canDo('program.create') && !mfg ? [{ id: 'a-prog', group: 'Lệnh tạo mới', label: 'Lập đề xuất quỹ 3M', icon: Coins, run: () => openProgramForm(), keys: 'mdf' }] : []),
    ...(canSee('supply') && canDo('po.manage') ? [{ id: 'a-po', group: 'Lệnh tạo mới', label: 'Tạo PO mới', sub: 'Đơn đặt hàng Hãng', icon: Ship, run: open('supply', 'po.create'), keys: 'dat hang purchase order' }] : []),
    ...(canSee('products') && canDo('po.manage') ? [{ id: 'a-sku', group: 'Lệnh tạo mới', label: 'Thêm sản phẩm / SKU', icon: Package, run: open('products', 'sku.create') }] : []),
    ...(canSee('cashbook') ? [
      { id: 'a-in', group: 'Lệnh tạo mới', label: 'Lập phiếu thu', icon: Coins, run: open('cashbook', 'cash.in'), keys: 'thu tien' },
      { id: 'a-out', group: 'Lệnh tạo mới', label: 'Lập phiếu chi', icon: Coins, run: open('cashbook', 'cash.out'), keys: 'chi tien' },
    ] : []),
    ...(canSee('staff') ? [{ id: 'a-trip', group: 'Lệnh tạo mới', label: 'Thêm lịch công tác / gặp khách', icon: CalendarDays, run: open('staff', 'staff.create') }] : []),
    ...(canSee('jobs') ? [{ id: 'a-job', group: 'Lệnh tạo mới', label: 'Thêm lead khảo sát (xưởng)', icon: Ruler, run: open('jobs', 'job.create') }] : []),
    ...MODULES.filter((m) => canSee(m)).map((m) => ({ id: `m-${m}`, group: 'Chuyển đến', label: `Chuyển đến ${MODULE_LABEL[m]}`, sub: MODULE_DESC[m], icon: MODULE_ICON[m], run: () => go(m), keys: MODULE_SHORT[m] })),
    ...extra,
  ].map((x) => ({ ...x, cmd: true }));
}

export function nlScore(q: string, it: PaletteItem): number {
  const words = fold(q).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  const hay = fold(`${it.label} ${it.keys ?? ''} ${it.sub ?? ''}`);
  const create = words.some((w) => ['tao', 'them', 'lap', 'nhap'].includes(w));
  const nav = words.some((w) => ['di', 'chuyen', 'den', 'sang', 'vao', 'xem'].includes(w));
  const core = words.filter((w) => !NL_CREATE.has(w) && !NL_GO.has(w));
  if (!core.length) return 0;
  const hit = core.filter((w) => hay.includes(w)).length;
  if (hit < core.length) return 0;
  return 10 + hit + (create && it.group === 'Lệnh tạo mới' ? 5 : 0) + (nav && it.group === 'Chuyển đến' ? 5 : 0);
}

export function CommandPalette({ onClose, extra = [], onAsk, image }: { onClose: () => void; extra?: PaletteItem[]; onAsk?: (q: string) => void; image?: File | 'pick' | null }) {
  const { myCustomers: customers, myLeads, programs, claims, canSee, go, openCustomer, openClaim, jobs, skus, zaloConvs, campaigns, openJob, me, hubCfg } = useApp();
  const aiP = useAi('copilot');
  const [img, setImg] = useState<File | null>(image instanceof File ? image : null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (image === 'pick') fileRef.current?.click(); }, [image]);
  const takeImage = (f?: File | null) => { if (f && /^image\//.test(f.type)) { setImg(f); return true; } return false; };
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const cmdMode = q.trimStart().startsWith('>');
  const t = fold(q.replace(/^\s*>\s*/, '').trim());
  const match = (...v: (string | undefined)[]) => !t || v.some((x) => x && fold(x).includes(t));
  const cmds = useCommandItems(extra);
  const records: PaletteItem[] = cmdMode || t.length < 1 ? [] : [
    ...(canSee('customers') ? customers.map((c) => ({ id: `c-${c.id}`, group: 'Khách hàng', label: c.name, sub: `${c.code}, MST ${c.taxCode}, ${c.contactPhone}`, icon: Users, run: () => { go('customers'); openCustomer(c.id); }, keys: `${c.address} ${c.contactName}` })) : []),
    ...(canSee('leads') ? myLeads.map((l) => ({ id: `l-${l.id}`, group: 'Lead / dự án', label: l.company, sub: `${l.code}, ${LEAD_STATUS[l.status].label}, ${l.phone}`, icon: Inbox, run: () => go(['ACCEPTED', 'QUOTED', 'WON', 'LOST'].includes(l.status) ? 'projects' : 'leads', l.code) })) : []),
    ...(canSee('claims') ? programs.map((p) => ({ id: `p-${p.id}`, group: 'Chương trình quỹ', label: p.title, sub: p.preApprovalId ?? p.code, icon: Briefcase, run: () => go('claims') })) : []),
    ...(canSee('claims') ? claims.map((c) => ({ id: `cl-${c.id}`, group: 'Hồ sơ claim', label: c.code, sub: c.programTitle, icon: FileCheck2, run: () => openClaim(c.id) })) : []),
    ...(canSee('jobs') ? jobs.map((j) => ({ id: `j-${j.id}`, group: 'Đơn hàng công trình', label: `${j.code} ${j.title}`, sub: `${jobCustName(j, customers)}, ${j.siteAddress}`, icon: Ruler, run: () => openJob(j.id), keys: `${j.sitePhone ?? ''} ${j.siteContact ?? ''}` })) : []),
    ...(canSee('products') ? skus.filter((x) => !x.archived).map((x) => ({ id: `s-${x.sku}`, group: 'Sản phẩm', label: `${x.sku} ${x.name}`, sub: `${x.brand}, ${x.category}, tồn ${fmtN(x.stock)} ${x.unit}`, icon: Package, run: () => { stickyStore.set('SkuCatalog.f', { ...SKU_FILTER0, q: x.sku }); go('products'); } })) : []),
    ...(canSee('zalo') && me ? zaloConvs.filter((z) => canSeeConv(z, me, hubCfg)).map((z) => ({ id: `z-${z.id}`, group: 'Hội thoại Zalo', label: z.displayName, sub: `${z.phone ? `${z.phone}, ` : ''}${z.lastText ?? ''}`, icon: MessageCircle, run: () => { stickyStore.set('ZaloHub.cur', z.id); go('zalo'); }, keys: z.address })) : []),
    ...(canSee('marketing') ? campaigns.map((c) => ({ id: `cp-${c.id}`, group: 'Chiến dịch marketing', label: c.name, sub: `${c.code}, ${fmtDate(c.start)} – ${fmtDate(c.end)}`, icon: Megaphone, run: () => go('marketing') })) : []),
  ];
  // Tìm theo nhiều từ (bỏ từ đệm như “khách”, “của”, “ở”), theo MST / số điện thoại (chỉ so phần số)
  const STOP = /^(tim|kiem|khach|hang|cua|o|tai|cho|mst|sdt|so|dien|thoai|ma|nha|xem|mo|don|ben)$/;
  const toks0 = t.split(/\s+/).filter(Boolean);
  const toks = toks0.some((w) => !STOP.test(w)) ? toks0.filter((w) => !STOP.test(w)) : toks0;
  const dig = q.replace(/\D/g, '');
  const recScore = (i: PaletteItem) => { const h = fold(`${i.label} ${i.sub ?? ''} ${i.keys ?? ''}`); if (dig.length >= 6 && h.replace(/\D/g, '').includes(dig)) return 3; if (!toks.length || !toks.every((w) => h.includes(w))) return 0; return fold(i.label).startsWith(toks[0]) ? 2 : 1; };
  const recHits = records.map((i) => [i, recScore(i)] as const).filter(([, sc]) => sc > 0).sort((a, b) => b[1] - a[1]).map(([i]) => i);
  const raw = q.replace(/^\s*>\s*/, '').trim();
  const plain = cmds.filter((i) => match(i.label, i.keys, i.sub && cmdMode ? i.sub : undefined));
  // Câu lệnh tự nhiên: chấm điểm theo từ khóa, xếp lên đầu
  const nl = raw.length > 2 ? cmds.map((i) => [i, nlScore(raw, i)] as const).filter(([, sc]) => sc > 0).sort((x, y) => y[1] - x[1]).map(([i]) => i) : [];
  const cmdHits = [...nl, ...plain.filter((i) => !nl.includes(i))];
  const askItem: PaletteItem[] = onAsk && raw.length > 3 ? [{ id: 'ask-ai', group: 'AI Copilot', label: `Hỏi AI Copilot: “${raw}”`, sub: `${aiP.available ? `${aiP.label} phân tích` : 'Phân tích'} trên dữ liệu CRM (SLA, dòng tiền, quỹ MDF, thưởng đại lý, công nợ...)`, icon: Sparkles, run: () => onAsk(raw), cmd: true }] : [];
  const question = looksLikeQuestion(raw);
  const results = cmdMode
    ? [...(/(phan tich|du bao|bao cao|tom tat|rui ro|thuong|so sanh|ban tin|danh gia)/.test(t) ? askItem : []), ...cmdHits.slice(0, 16), ...(cmdHits.length || /(phan tich|du bao|bao cao|tom tat|rui ro|thuong|so sanh|ban tin|danh gia)/.test(t) ? [] : askItem)]
    : t ? [...(question ? askItem : []), ...recHits.slice(0, 10), ...cmdHits.slice(0, 6), ...(question ? [] : askItem)] : cmdHits.filter((x) => x.group !== 'Chuyển đến').slice(0, 8);
  const run = (i?: PaletteItem) => { if (!i) return; onClose(); i.run(); };
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [active]);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-[#05070B]/55 p-4 pt-[16vh] backdrop-blur-[2px] motion-safe:animate-[fadeIn_.12s_ease-out]" onClick={onClose} role="dialog" aria-modal="true" aria-label="Spotlight: tìm kiếm và lệnh">
      <div className="glass w-full max-w-2xl overflow-hidden rounded-lg border border-[rgb(var(--ink)/0.1)] shadow-[0_30px_80px_rgba(0,0,0,.6)] motion-safe:animate-[popIn_.16s_ease-out]" onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); }} onDrop={(e) => { if (takeImage(e.dataTransfer.files?.[0])) e.preventDefault(); }}>
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { takeImage(e.target.files?.[0]); e.target.value = ''; }} />
        <div className="flex items-center gap-3 border-b border-[rgb(var(--ink)/0.08)] px-5">
          {cmdMode ? <span className="g-brand-text font-mono text-xl font-semibold" aria-hidden>&gt;</span> : <Search className="h-5 w-5 text-[rgb(var(--muted))]" aria-hidden />}
          <input
            ref={inputRef}
            className="h-16 flex-1 bg-transparent text-lg text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted)/0.8)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--fg)/0.4)]"
            placeholder="Tìm khách, MST, SĐT, mã đơn… gõ > để ra lệnh, hỏi AI, hoặc dán / kéo thả ảnh"
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === 'Enter') { e.preventDefault(); run(results[active]); }
              if (e.key === 'Escape') onClose();
            }}
            onPaste={(e) => { const f = [...e.clipboardData.files].find((x) => /^image\//.test(x.type)); if (takeImage(f)) e.preventDefault(); }}
            aria-label="Tìm kiếm hoặc nhập lệnh"
            aria-controls="spotlight-list"
            aria-activedescendant={results[active] ? `sp-${results[active].id}` : undefined}
          />
          <button className={cn('flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium', img ? 'border-[rgb(var(--accent))] text-[rgb(var(--accent-fg))]' : 'border-[rgb(var(--line))] text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')} onClick={() => fileRef.current?.click()} title="Tìm bằng hình ảnh (ảnh mẫu, bản vẽ CAD / SketchUp xuất ảnh, phụ kiện)"><Camera className="h-4 w-4" aria-hidden /><span className="max-sm:hidden">Tìm bằng ảnh</span></button>
          <kbd className="rounded-sm border border-[rgb(var(--ink)/0.1)] px-1.5 py-0.5 text-[11px] text-[rgb(var(--muted))]">Esc</kbd>
        </div>
        {!q && !img && (
          <div className="flex flex-wrap gap-1.5 border-b border-[rgb(var(--ink)/0.06)] px-5 py-2.5">
            {['> Tạo PO mới', 'tạo phiếu chi', 'đi tới công nợ', 'Dự án nào có rủi ro trễ SLA?'].map((x) => (
              <button key={x} className="rounded-sm border border-[rgb(var(--ink)/0.1)] px-2 py-1 font-mono text-[11px] text-[rgb(var(--muted))] hover:border-[rgb(var(--secondary))] hover:text-[rgb(var(--fg))]" onClick={() => { setQ(x); setActive(0); inputRef.current?.focus(); }}>{x}</button>
            ))}
          </div>
        )}
        {img ? <VisualSearchPanel file={img} onReset={() => { setImg(null); fileRef.current?.click(); }} onPick={onClose} /> : <ul id="spotlight-list" ref={listRef} className="max-h-[52vh] overflow-y-auto py-2" role="listbox">
          {results.map((r, i) => (
            <li key={r.id} id={`sp-${r.id}`} role="option" aria-selected={i === active}>
              {(i === 0 || results[i - 1].group !== r.group) && <p className="px-5 pb-1 pt-2 text-[11px] font-semibold text-[rgb(var(--faint))]">{r.group}</p>}
              <button className={cn('flex w-full items-center gap-3 px-5 py-2.5 text-left', i === active ? 'bg-[rgb(var(--secondary)/0.25)]' : 'hover:bg-[rgb(var(--ink)/0.04)]')} onMouseEnter={() => setActive(i)} onClick={() => run(r)}>
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded', r.cmd ? 'bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent-fg))]' : 'bg-[rgb(var(--ink)/0.05)] text-[rgb(var(--muted))]')}><r.icon className="h-4 w-4" aria-hidden /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm">{r.label}</span>{r.sub && <span className="block truncate text-xs text-[rgb(var(--muted))]">{r.sub}</span>}</span>
                {i === active && <kbd className="rounded-sm border border-[rgb(var(--ink)/0.1)] px-1.5 py-0.5 text-[11px] text-[rgb(var(--muted))]">Enter</kbd>}
              </button>
            </li>
          ))}
          {!results.length && <li className="px-5 py-10 text-center text-sm text-[rgb(var(--muted))]">Không có kết quả cho "{q}". Thử gõ <span className="code-chip">&gt;</span> để xem danh sách lệnh.</li>}
        </ul>}
        <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[rgb(var(--ink)/0.06)] px-5 py-2 text-[11px] text-[rgb(var(--faint))]"><span>↑ ↓ chọn</span><span>Enter mở</span><span><b className="code-chip">&gt;</b> chế độ lệnh</span><span>Ctrl/⌘ + K mở từ mọi màn hình</span></p>
      </div>
    </div>
  );
}

/** Chọn phòng ban để phân lead (thủ công); phòng gợi ý theo quy tắc nhóm khách / khu vực được đánh dấu */
export function RouteMenu({ lead, primary = false }: { lead: Lead; primary?: boolean }) {
  const { routableDepts, routeLeads, canDo, customers, segRules, departments } = useApp();
  const hint = decideDept(lead, customers, segRules, departments).code;
  return (
    <RowMenu
      text="Phân phòng"
      icon={ArrowRight}
      primary={primary}
      items={routableDepts.filter((d) => d.code !== lead.dept).map((d) => ({ label: `${d.name}${d.code === hint ? ' (gợi ý)' : ''}`, onClick: () => routeLeads([lead.id], d.code), disabled: !canDo('lead.route') }))}
    />
  );
}

