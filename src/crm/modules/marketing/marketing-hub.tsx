'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Banknote, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Columns3, Copy, Download, Gauge, GripVertical, History, ImagePlus, Inbox, List, Lock, Package, Plus, RefreshCw, Search, Sparkles, Trash2, TrendingUp, Upload, Wallet, X } from 'lucide-react';
import { ConfirmDialog } from '../../components/crud';
import { Chip, EmptyState, Field, Panel, SideSheet, StatCard, Table, Tabs, useSticky } from '../../components/ui';
import { AI_NAME, aiErrText, AUD_FIELDS, AUD_OPS, AUTO_CH, AUTO_TRIGGER, BANNER_PRESETS, BANNER_SIZE, bizMode, blocksToHtml, blocksToMarkdown, boqTotal, btnAccent, btnGhost, btnPrimary, btnSm, C, CAMP_STATUS, compact, CONTENT_STATUS, dayMs, downloadBlob, fillVars, fmtDate, fold, inputBase, inputCls, isoDay, JOB_LABEL, kpiGrid, LEAD_STATUS, leadAt, MKT_CH, MKT_OPEN_EVT, MKT_TABS, rowCls, shrinkImage, SOURCE_LABEL, ST_OF_CHANNEL, ST_VARIANT_CACHE, stArr, stCompanyOf, stFold, stHas, stickyStore, stOutlinePrompt, stSectionPrompt, stStr, STUDIO_STEPS, studioSupports, subjectOf, TASK_STATUS, tdCls, tdFirst, tdLast, uid, useApp, vAspect, vCfgOf, vImg, vKey, WRITER, WRITER_TONES } from '../../lib/core';
import { downloadCsv, xlsxBlob } from '../../lib/csv';
import type { AiJob, AppCtx, AudBase, Audience, AudOp, AudRule, AutoChannel, Automation, AutoRun, AutoStep, AutoSubject, AutoTrigger, BannerSize, BannerSpec, CalView, Campaign, CompanyInfo, ConfirmState, ContentBlock, ContentStatus, Customer, ImgAspect, Job, Lead, MktChannel, MktContent, MktContentType, MktTab, MktTask, StArticle, StSettings, TaskStatus, TitleReport, WriterPreset } from '../../lib/types';
import { cn } from '../../lib/utils';
import { apiPost, parseAiJson, useAi, useServerStatus } from '../ai/ai-core';
import { useWriter } from '../ai/copilot-plus';
import { loadImg } from '../ai/visual-search';
import { applyWatermark, getPlatform, stClip, StudioWorkspace } from './content-studio';
import { AutomationHub, CampaignRowMenu, CampaignSheet, ContentRowMenu, ImageStudioTab, TaskRowMenu, TaskSheet, vText } from './content-workspace';
import { Switch } from '../platform/console';

/** Kết quả chiến dịch: lead theo kênh nguồn trong thời gian chạy (+30 ngày), doanh thu từ lead đã chốt / đơn đã ký */
export function campaignStats(c: Campaign, leads: Lead[], jobs: Job[]) {
  const srcs = new Set(c.channels.flatMap((ch) => MKT_CH[ch].sources));
  const s = new Date(c.start).getTime();
  const e = new Date(c.end).getTime() + 30 * dayMs;
  const ls = leads.filter((l) => srcs.has(l.source) && leadAt(l) >= s && leadAt(l) <= e);
  const won = ls.filter((l) => l.status === 'WON');
  const jobRev = jobs.filter((j) => j.wonAt && j.leadId && ls.some((l) => l.id === j.leadId)).reduce((a, j) => a + (j.contractValue ?? 0), 0);
  const revenue = won.reduce((a, l) => a + (l.wonAmount ?? boqTotal(l)), 0) + jobRev + (c.manualRevenue ?? 0);
  const nLeads = ls.length + (c.manualLeads ?? 0);
  return { leads: nLeads, won: won.length + jobs.filter((j) => j.wonAt && j.leadId && ls.some((l) => l.id === j.leadId)).length, revenue, cpl: nLeads ? c.spent / nLeads : 0, roi: c.spent ? (revenue - c.spent) / c.spent : 0 };
}

export function audienceMembers(a: Audience, app: AppCtx): (Customer | Lead)[] {
  const rows: (Customer | Lead)[] = a.base === 'CUSTOMER' ? app.myCustomers : app.myLeads;
  const ok = (r: Customer | Lead, ru: AudRule) => {
    const f = AUD_FIELDS[a.base].find((x) => x.key === ru.field); if (!f) return true;
    const v = f.get(r, app);
    if (f.type === 'bool') return String(!!v) === ru.value;
    if (ru.op === 'contains') return fold(String(v)).includes(fold(ru.value));
    if (ru.op === 'gte') return Number(v) >= Number(ru.value);
    if (ru.op === 'lte') return Number(v) <= Number(ru.value);
    if (ru.op === 'neq') return String(v) !== ru.value;
    return String(v) === ru.value;
  };
  return rows.filter((r) => (!a.rules.length ? true : a.match === 'ALL' ? a.rules.every((ru) => ok(r, ru)) : a.rules.some((ru) => ok(r, ru))));
}

/** Đối tượng thỏa điều kiện kích hoạt của kịch bản tại thời điểm hiện tại */
export function autoSubjects(w: Automation, app: AppCtx, now: number): AutoSubject[] {
  const { myLeads: leads, myCustomers: customers, jobs, quotes, zaloConvs, audiences } = app;
  let out: AutoSubject[] = [];
  if (w.trigger === 'LEAD_NEW') out = leads.filter((l) => l.receivedDaysAgo <= Math.max(1, w.days) && !['WON', 'LOST'].includes(l.status)).map((l) => subjectOf(l, app));
  if (w.trigger === 'QUOTE_NO_REPLY') out = leads.filter((l) => l.status === 'QUOTED' && quotes.filter((q) => q.leadId === l.id).some((q) => now - new Date(q.date).getTime() >= w.days * dayMs)).map((l) => subjectOf(l, app));
  if (w.trigger === 'JOB_WON') out = jobs.filter((j) => j.wonAt && now - new Date(j.wonAt).getTime() <= Math.max(1, w.days) * dayMs).map((j) => { const c = customers.find((x) => x.id === j.customerId); return { kind: 'job' as const, id: j.id, name: j.siteContact || c?.name || j.title, phone: j.sitePhone || c?.contactPhone, customerId: j.customerId, zaloUserId: zaloConvs.find((z) => (z.links ?? []).some((l) => (l.kind === 'job' && l.id === j.id) || (l.kind === 'customer' && l.id === j.customerId)))?.zaloUserId }; });
  if (w.trigger === 'ZALO_FOLLOW') out = zaloConvs.filter((z) => z.followed !== false && (z.createdAt ?? 0) >= (w.activatedAt ?? now)).map((z) => ({ kind: 'zalo' as const, id: z.id, name: z.displayName, phone: z.phone, zaloUserId: z.zaloUserId }));
  if (w.trigger === 'INACTIVE_CUSTOMER') out = customers.filter((c) => c.ytdRevenue === 0 && c.lastYearRevenue > 0).map((c) => subjectOf(c, app));
  const aud = audiences.find((a) => a.id === w.audienceId);
  if (w.trigger === 'AUDIENCE') return aud ? audienceMembers(aud, app).map((r) => subjectOf(r, app)) : [];
  if (aud) {
    const m = audienceMembers(aud, app);
    const ids = new Set(m.map((r) => r.id));
    const custIds = new Set(m.map((r) => ('company' in r ? r.customerId : r.id)).filter(Boolean) as string[]);
    out = out.filter((s) => ids.has(s.id) || (s.customerId && custIds.has(s.customerId)));
  }
  return out;
}

/** Bộ chạy kịch bản tự động: chạy trên phiên của Marketing / BOD đang mở app, mỗi phút một lần */
export function AutomationEngine() {
  const app = useApp();
  const { automations, autoRuns, setAutoRuns, hubCfg, canDo, company, addMsgLog, org } = app;
  const [srv] = useServerStatus();
  const ref = useRef({ app, srv });
  ref.current = { app, srv };
  const busy = useRef(false);
  useEffect(() => {
    if (!canDo('mkt.manage')) return;
    const tick = async () => {
      if (busy.current) return;
      busy.current = true;
      const { app: a, srv: s } = ref.current;
      const now = Date.now();
      const have = new Set(a.autoRuns.map((r) => r.id));
      const fresh: AutoRun[] = [];
      a.automations.filter((w) => w.active && w.steps.length).forEach((w) => autoSubjects(w, a, now).forEach((sub) => {
        const id = `${w.id}:${sub.kind}:${sub.id}`;
        if (!have.has(id)) { have.add(id); fresh.push({ id, wfId: w.id, subject: sub, step: 0, nextAt: now + w.steps[0].wait * 3.6e6, status: 'ACTIVE', startedAt: now, log: [] }); }
      }));
      if (fresh.length) setAutoRuns((p) => [...fresh, ...p].slice(0, 3000));
      const due = [...fresh, ...a.autoRuns].filter((r) => r.status === 'ACTIVE' && r.nextAt <= now).slice(0, 30);
      for (const r of due) {
        const w = a.automations.find((x) => x.id === r.wfId);
        if (!w || !w.active) continue;
        const st = w.steps[r.step];
        if (!st) { setAutoRuns((p) => p.map((x) => (x.id === r.id ? { ...x, status: 'DONE' } : x))); continue; }
        setAutoRuns((p) => p.map((x) => (x.id === r.id ? { ...x, nextAt: now + 300_000 } : x)));
        const vars = { ten: r.subject.name, congty: company.shortName || company.appName, ma: r.subject.id };
        const text = fillVars(st.text, vars);
        let ok = true; let detail = '';
        if (w.dryRun) detail = 'Chạy thử: không gửi thật';
        else if (st.channel === 'ZNS') {
          const tpl = hubCfg.zalo.znsTemplates.find((x) => x.id === st.znsId);
          if (!tpl || !r.subject.phone) { ok = false; detail = !tpl ? 'Chưa chọn mẫu ZNS' : 'Đối tượng không có số điện thoại'; }
          else if (!s.zalo.oa) detail = 'Mô phỏng (máy chủ chưa cấu hình Zalo)';
          else {
            const data = Object.fromEntries(tpl.params.map((p) => [p.key, p.source === 'customer.name' ? r.subject.name : p.source === 'customer.phone' ? r.subject.phone ?? '' : p.source === 'company.name' ? vars.congty : p.source === 'today' ? new Date().toLocaleDateString('vi-VN') : text]));
            const res = await apiPost('/api/zalo/zns', { tenant: org.id, phone: r.subject.phone, templateId: tpl.templateId, data, trackingId: r.id.slice(-40) });
            ok = res.ok; detail = res.ok ? 'Đã gửi ZNS' : aiErrText(res.error);
          }
          addMsgLog({ channel: 'ZNS', to: r.subject.phone ?? r.subject.name, subject: `Tự động: ${w.name}`, ok, detail });
        } else if (st.channel === 'ZALO_OA') {
          if (!r.subject.zaloUserId) { ok = false; detail = 'Khách chưa kết nối Zalo OA'; }
          else if (!s.zalo.oa) detail = 'Mô phỏng (máy chủ chưa cấu hình Zalo)';
          else { const res = await apiPost('/api/zalo/send', { tenant: org.id, userId: r.subject.zaloUserId, text }); ok = res.ok; detail = res.ok ? 'Đã gửi tin Zalo OA' : aiErrText(res.error); }
        } else detail = `${AUTO_CH[st.channel]}: mô phỏng (chưa kết nối nhà cung cấp)`;
        const next = r.step + 1;
        setAutoRuns((p) => p.map((x) => (x.id === r.id ? { ...x, step: next, status: !ok ? 'FAILED' : next >= w.steps.length ? 'DONE' : 'ACTIVE', nextAt: next < w.steps.length ? Date.now() + w.steps[next].wait * 3.6e6 : x.nextAt, log: [...x.log, { at: Date.now(), step: r.step, channel: st.channel, ok, detail }] } : x)));
      }
      busy.current = false;
    };
    void tick();
    const t = window.setInterval(() => void tick(), 60_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automations.length, automations.map((w) => `${w.id}${w.active}${w.dryRun}`).join(), autoRuns.length]);
  return null;
}

// ---------------- Vẽ banner bằng canvas ----------------
export function wrapText(x: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  text.split('\n').forEach((para) => {
    let line = '';
    para.split(/\s+/).forEach((w) => { const tst = line ? `${line} ${w}` : w; if (x.measureText(tst).width > maxW && line) { out.push(line); line = w; } else line = tst; });
    out.push(line);
  });
  return out;
}

export async function drawBanner(cv: HTMLCanvasElement, b: BannerSpec, brand: string, logo?: string) {
  const S = BANNER_SIZE[b.size];
  cv.width = S.w; cv.height = S.h;
  const x = cv.getContext('2d'); if (!x) return;
  const g = x.createLinearGradient(0, 0, S.w, S.h); g.addColorStop(0, b.bg); g.addColorStop(1, b.bg2 || b.bg);
  x.fillStyle = g; x.fillRect(0, 0, S.w, S.h);
  const img = async (src?: string) => (src ? loadImg(src).catch(() => null) : null);
  const bgi = await img(b.bgImage);
  if (bgi) { const k = Math.max(S.w / bgi.width, S.h / bgi.height); x.drawImage(bgi, (S.w - bgi.width * k) / 2, (S.h - bgi.height * k) / 2, bgi.width * k, bgi.height * k); x.fillStyle = 'rgba(8,12,20,.5)'; x.fillRect(0, 0, S.w, S.h); }
  const u = Math.min(S.w, S.h) / 100;
  // dải màu nhấn
  x.fillStyle = b.accent; x.globalAlpha = 0.9;
  if (b.layout === 'LEFT') { x.beginPath(); x.moveTo(S.w * 0.62, 0); x.lineTo(S.w * 0.7, 0); x.lineTo(S.w * 0.52, S.h); x.lineTo(S.w * 0.44, S.h); x.closePath(); x.fill(); }
  else if (b.layout === 'SPLIT') { x.fillRect(S.w * 0.5, 0, S.w * 0.5, S.h); }
  else { x.fillRect(0, S.h - u * 1.6, S.w, u * 1.6); }
  x.globalAlpha = 1;
  const prod = await img(b.productImage);
  if (prod) {
    const box = b.layout === 'CENTER' ? { x: S.w * 0.2, y: S.h * 0.5, w: S.w * 0.6, h: S.h * 0.38 } : { x: S.w * 0.55, y: S.h * 0.1, w: S.w * 0.4, h: S.h * 0.8 };
    const k = Math.min(box.w / prod.width, box.h / prod.height);
    x.drawImage(prod, box.x + (box.w - prod.width * k) / 2, box.y + (box.h - prod.height * k) / 2, prod.width * k, prod.height * k);
  }
  const pad = u * 7;
  const tw = b.layout === 'CENTER' ? S.w - pad * 2 : S.w * 0.46;
  const align: CanvasTextAlign = b.layout === 'CENTER' ? 'center' : 'left';
  const tx = b.layout === 'CENTER' ? S.w / 2 : pad;
  x.textAlign = align; x.textBaseline = 'top';
  if (b.showLogo) {
    const li = await img(logo);
    if (li) { const h = u * 9; x.drawImage(li, b.layout === 'CENTER' ? S.w / 2 - (li.width * h) / li.height / 2 : pad, pad * 0.7, (li.width * h) / li.height, h); }
    else { x.fillStyle = b.ink; x.font = `800 ${u * 4.6}px Archivo, 'Be Vietnam Pro', sans-serif`; x.fillText(brand.toUpperCase(), tx, pad * 0.8); }
  }
  let y = b.layout === 'CENTER' ? S.h * (prod ? 0.16 : 0.28) : S.h * 0.26;
  x.fillStyle = b.ink; x.font = `800 ${u * (S.h > S.w ? 7.5 : 8.6)}px Archivo, 'Be Vietnam Pro', sans-serif`;
  wrapText(x, b.headline, tw).slice(0, 4).forEach((ln) => { x.fillText(ln, tx, y); y += u * (S.h > S.w ? 8.8 : 10); });
  y += u * 1.5;
  x.globalAlpha = 0.88; x.font = `500 ${u * 4}px 'Be Vietnam Pro', sans-serif`;
  wrapText(x, b.sub, tw).slice(0, 4).forEach((ln) => { x.fillText(ln, tx, y); y += u * 5.4; });
  x.globalAlpha = 1;
  if (b.cta) {
    y += u * 3;
    x.font = `700 ${u * 4}px 'Be Vietnam Pro', sans-serif`;
    const w = x.measureText(b.cta).width + u * 8; const h = u * 9;
    const bx = b.layout === 'CENTER' ? S.w / 2 - w / 2 : pad;
    x.fillStyle = b.layout === 'SPLIT' ? b.ink : b.accent;
    const r0 = h / 2; x.beginPath(); x.moveTo(bx + r0, y); x.lineTo(bx + w - r0, y); x.arc(bx + w - r0, y + r0, r0, -Math.PI / 2, Math.PI / 2); x.lineTo(bx + r0, y + h); x.arc(bx + r0, y + r0, r0, Math.PI / 2, Math.PI * 1.5); x.closePath(); x.fill();
    x.fillStyle = b.layout === 'SPLIT' ? b.bg : '#FFFFFF'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(b.cta, bx + w / 2, y + h / 2);
  }
}

export function MarketingHubPage() {
  const app = useApp();
  const { campaigns, myLeads, jobs, now, canDo } = app;
  const [tab0, setTab] = useSticky<MktTab>('Mkt.tab', 'calendar');
  // tab cũ đã gộp: Thiết kế banner → Image, Phân khúc → Automation
  const tab: MktTab = MKT_TABS.includes(tab0) ? tab0 : (tab0 as string) === 'banner' ? 'image' : (tab0 as string) === 'audience' ? 'automation' : 'calendar';
  useEffect(() => { const f = () => setTab('content'); window.addEventListener(MKT_OPEN_EVT, f); return () => window.removeEventListener(MKT_OPEN_EVT, f); }, [setTab]);
  const t = now ?? Date.now();
  const year = new Date(t).getFullYear();
  const yc = campaigns.filter((c) => c.start.startsWith(String(year)) || c.end.startsWith(String(year)));
  const stats = yc.map((c) => campaignStats(c, myLeads, jobs));
  const spent = yc.reduce((s, c) => s + c.spent, 0);
  const rev = stats.reduce((s, x) => s + x.revenue, 0);
  const tabs: { id: MktTab; label: string }[] = [
    { id: 'calendar', label: 'Plan' }, { id: 'content', label: 'Content' }, { id: 'image', label: 'Image' },
    { id: 'roi', label: 'Budget' }, { id: 'automation', label: 'Automation' },
  ];
  return (
    <div className="space-y-4">
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {(tab === 'calendar' || tab === 'roi') && (
        <div className={kpiGrid('lg:grid-cols-4')}>
          <StatCard label={`Ngân sách ${year}`} value={compact(yc.reduce((s, c) => s + c.budget, 0))} sub={`${yc.length} chiến dịch, ${yc.filter((c) => c.status === 'RUNNING').length} đang chạy`} icon={Wallet} color={C.blue} />
          <StatCard label="Đã chi" value={compact(spent)} sub={yc.reduce((s, c) => s + c.budget, 0) ? `${Math.round((spent / yc.reduce((s, c) => s + c.budget, 0)) * 100)}% ngân sách` : 'Chưa có ngân sách'} icon={Banknote} color={C.orange} />
          <StatCard label="Lead từ chiến dịch" value={String(stats.reduce((s, x) => s + x.leads, 0))} sub={`CPL ${compact(stats.reduce((s, x) => s + x.leads, 0) ? spent / stats.reduce((s, x) => s + x.leads, 0) : 0)}`} icon={Inbox} color={C.teal} />
          <StatCard label="ROI marketing" value={spent ? `${Math.round(((rev - spent) / spent) * 100)}%` : '—'} sub={`Doanh thu ghi nhận ${compact(rev)}`} icon={TrendingUp} color={rev >= spent ? C.teal : C.red} />
        </div>
      )}
      {tab === 'calendar' && <CampaignCalendar />}
      {tab === 'roi' && <CampaignRoi />}
      {tab === 'content' && <ContentStudio />}
      {tab === 'image' && <ImageStudioTab />}
      {tab === 'automation' && <AutomationHub />}
      {!canDo('mkt.manage') && <p className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]"><Lock className="h-3.5 w-3.5" aria-hidden />Chế độ xem. Trưởng Marketing hoặc Giám đốc được tạo / sửa chiến dịch, nội dung và kịch bản tự động.</p>}
    </div>
  );
}

/** Chấm tiêu đề cục bộ khi chưa kết nối AI: độ dài, con số, từ khóa hành động, dấu câu, từ khóa chính */
export function localTitleReport(title: string, type: MktContentType, brand: string): TitleReport {
  const t = title.trim();
  const f = fold(t);
  const len = t.length;
  const seoNotes: string[] = []; const socNotes: string[] = []; const tips: string[] = [];
  let seo = 50; let soc = 50;
  if (len >= 40 && len <= 65) { seo += 20; seoNotes.push(`Độ dài ${len} ký tự, phù hợp hiển thị trên Google`); } else { seo -= 5; seoNotes.push(`Độ dài ${len} ký tự (nên 40–65 để không bị cắt trên Google)`); tips.push(len < 40 ? 'Thêm từ khóa hoặc lợi ích cụ thể để tiêu đề đủ ý' : 'Rút gọn, đưa từ khóa chính lên đầu'); }
  if (/\d/.test(t)) { seo += 8; soc += 12; socNotes.push('Có con số cụ thể, tăng tỷ lệ nhấp'); } else tips.push('Thêm con số (năm, %, số lượng) để cụ thể hơn');
  if (/(cach|bi quyet|huong dan|kinh nghiem|giai phap|so sanh|top|meo|luu y)/.test(f)) { seo += 10; seoNotes.push('Có từ khóa ý định tìm kiếm (cách, hướng dẫn, giải pháp…)'); } else tips.push('Dùng từ khóa ý định: “Cách…”, “Giải pháp…”, “Kinh nghiệm…”');
  if (/(uu dai|mien phi|giam|qua tang|moi|doc quyen|chinh hang|bao hanh)/.test(f)) { soc += 15; socNotes.push('Có từ kích thích hành động (ưu đãi, miễn phí, chính hãng…)'); } else tips.push('Thêm lợi ích rõ ràng cho khách (ưu đãi, bảo hành, miễn phí khảo sát…)');
  if (/[?:–-]/.test(t)) { soc += 8; socNotes.push('Có dấu nhấn (?, :, –) tạo nhịp đọc'); }
  if (/!{2,}|[A-ZÀ-Ỹ]{8,}/.test(t)) { soc -= 10; socNotes.push('Tránh viết hoa toàn bộ hoặc nhiều dấu chấm than'); }
  const score = Math.max(5, Math.min(98, Math.round((seo + soc) / 2)));
  const core = t.replace(/[–:|-].*$/, '').trim() || t;
  const y = new Date().getFullYear();
  const suggestions = type === 'PRESS'
    ? [`${brand} công bố ${core.toLowerCase()}`, `${core}: bước tiến mới của ${brand} năm ${y}`, `${brand} ra mắt ${core.toLowerCase()} cho thị trường Việt Nam`]
    : [`${core}: 5 lưu ý quan trọng trước khi chọn (${y})`, `Cách chọn ${core.toLowerCase()} bền, đẹp, đúng ngân sách`, `${core} chính hãng – ưu đãi đến 15%, khảo sát miễn phí`];
  return { score, seo: { score: Math.min(100, seo), notes: seoNotes }, social: { score: Math.min(100, soc), notes: socNotes }, tips: tips.slice(0, 4), suggestions, by: 'Chấm điểm theo quy tắc (chưa kết nối AI)', at: Date.now() };
}

/** Dàn ý mẫu theo loại nội dung khi chưa kết nối AI */
export function localOutline(title: string, type: MktContentType, prompt: string): ContentBlock[] {
  const B = (heading: string, points: string, level: 2 | 3 = 2): ContentBlock => ({ id: uid('bk'), level, heading, points, body: '' });
  const core = title.replace(/[–:|-].*$/, '').trim() || title;
  const extra = prompt.split(/\n|;/).map((x) => x.trim()).filter(Boolean);
  if (type === 'PRESS') return [B('Thông tin chính', 'Ai, làm gì, ở đâu, khi nào'), B('Bối cảnh và ý nghĩa', 'Vì sao quan trọng với khách hàng, thị trường'), B('Điểm nổi bật', extra.join('; ') || 'Sản phẩm / chương trình, con số nổi bật'), B('Phát biểu của lãnh đạo', 'Trích dẫn ngắn'), B('Thông tin liên hệ', 'Đầu mối báo chí, website, hotline')];
  if (type === 'ZNS' || type === 'CARE_MSG') return [B('Lời chào và mục đích', 'Xưng hô, lý do nhắn'), B('Thông tin chính', extra.join('; ') || 'Ưu đãi / lịch hẹn / nhắc bảo hành'), B('Kêu gọi hành động', 'Liên hệ, đặt lịch, phản hồi')];
  if (type === 'ZALO_OA' || type === 'AD_POST') return [B(`Vì sao nên chọn ${core}?`, 'Nỗi đau khách hàng, câu mở thu hút'), B('Lợi ích nổi bật', extra.join('; ') || '3 lợi ích chính'), B('Ưu đãi và cam kết', 'Ưu đãi, bảo hành, thời hạn'), B('Đăng ký nhận tư vấn', 'Kêu gọi hành động, thông tin liên hệ')];
  return [B(`${core} là gì? Khi nào cần dùng`, 'Định nghĩa ngắn, tình huống sử dụng'), B('Những vấn đề khách hàng hay gặp', 'Sai lầm phổ biến, hậu quả'), B(`Giải pháp ${core.toLowerCase()} hiệu quả`, extra.join('; ') || 'Giải pháp, quy trình'), B('Tiêu chí lựa chọn', 'Chất lượng, chứng nhận, bảo hành', 3), B('Chi phí tham khảo', 'Khoảng giá, yếu tố ảnh hưởng', 3), B('Câu hỏi thường gặp', '3 câu hỏi và trả lời ngắn'), B('Kết luận và tư vấn', 'Tóm tắt, kêu gọi liên hệ')];
}

export function localBlockText(b: ContentBlock, title: string, company: CompanyInfo): string {
  const brand = company.shortName || company.appName;
  const pts = b.points.split(/;|\n/).map((x) => x.trim()).filter(Boolean);
  return `${b.heading} là phần quan trọng khi tìm hiểu ${title.toLowerCase()}. ${pts.length ? `Các ý chính: ${pts.join(', ')}.` : ''} ${brand} tư vấn dựa trên kinh nghiệm thực tế tại công trình, giúp khách hàng chọn đúng giải pháp, tối ưu chi phí và yên tâm về chất lượng.\n\nLiên hệ ${company.phone || brand} để được hỗ trợ chi tiết.`.replace(/\s+\n/g, '\n').trim();
}

/** Ảnh minh họa mẫu (canvas) khi chưa có API tạo ảnh: nền chuyển màu + tiêu đề tiểu mục */
export function placeholderImage(heading: string, brand: string, aspect: ImgAspect): string {
  const W = aspect === 'portrait' ? 768 : 1024; const H = aspect === 'landscape' ? 576 : aspect === 'square' ? 1024 : 1152;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); if (!x) return '';
  const h = [...heading].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const pal = [['#0B1F3A', '#2563EB'], ['#7C2D12', '#F28C28'], ['#064E3B', '#10B981'], ['#312E81', '#8B5CF6'], ['#1F2937', '#0EA5E9']][h % 5];
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.globalAlpha = 0.12; x.fillStyle = '#fff';
  for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(((h >> i) % W) + i * 90, ((h >> (i + 3)) % H), 60 + i * 30, 0, Math.PI * 2); x.fill(); }
  x.globalAlpha = 1; x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `700 ${Math.round(W / 20)}px 'Be Vietnam Pro', sans-serif`;
  const lines = wrapText(x, heading, W * 0.8).slice(0, 3);
  lines.forEach((ln, i) => x.fillText(ln, W / 2, H / 2 + (i - (lines.length - 1) / 2) * (W / 15)));
  x.globalAlpha = 0.75; x.font = `500 ${Math.round(W / 48)}px 'Be Vietnam Pro', sans-serif`;
  x.fillText(`${brand} · Ảnh minh họa mẫu (chưa kết nối API tạo ảnh)`, W / 2, H - W / 24);
  return c.toDataURL('image/jpeg', 0.85);
}

/** Thu nhỏ ảnh AI (PNG lớn) thành JPEG ≤ 1280px để lưu gọn */
export async function compactImage(src: string, max = 1280): Promise<string> {
  try {
    const img = await loadImg(src);
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const x = c.getContext('2d'); if (!x) return src;
    x.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.84);
  } catch { return src; }
}

/** Các bước AI dùng chung cho Studio và bộ xử lý nền */
export function useStudioAi() {
  const app = useApp();
  const { company, hubCfg, org } = app;
  const ai = useAi('writer');
  const [srv] = useServerStatus();
  const brand = company.shortName || company.appName;
  const imgOn = hubCfg.ai.enabled && hubCfg.ai.features.image !== false && srv.images;
  const sector = bizMode(company) === 'MFG' ? 'nội thất, tủ bếp, cửa nhôm kính, lắp đặt công trình dân dụng' : 'vật tư điện trung thế, phụ kiện cáp, băng keo và vật liệu 3M cho công trình công nghiệp';
  const analyze = async (title: string, type: MktContentType, channel?: MktChannel): Promise<TitleReport> => {
    if (ai.available) {
      const r = await ai.ask({ maxTokens: 700, system: 'Bạn là chuyên gia SEO và social marketing tiếng Việt. Chỉ trả về JSON.', prompt: `Đánh giá tiêu đề "${title}" cho ${WRITER[type].label}${channel ? ` trên kênh ${MKT_CH[channel].label}` : ''} của ${brand} (lĩnh vực ${sector}). Trả về JSON {"score":0-100,"seo":{"score":0-100,"notes":["..."]},"social":{"score":0-100,"notes":["..."]},"tips":["..."],"suggestions":["3 tiêu đề tối ưu hơn, mỗi tiêu đề ≤ 70 ký tự"]}.` });
      const j = r.ok ? parseAiJson<Omit<TitleReport, 'by' | 'at'>>(r.text) : null;
      if (j && Array.isArray(j.suggestions)) return { score: Number(j.score) || 0, seo: { score: Number(j.seo?.score) || 0, notes: j.seo?.notes ?? [] }, social: { score: Number(j.social?.score) || 0, notes: j.social?.notes ?? [] }, tips: j.tips ?? [], suggestions: j.suggestions.slice(0, 3), by: r.ok ? `${AI_NAME[r.provider]} · ${r.model}` : '', at: Date.now() };
    }
    return localTitleReport(title, type, brand);
  };
  const outline = async (title: string, type: MktContentType, prompt: string): Promise<{ blocks: ContentBlock[]; by: string }> => {
    if (ai.available) {
      const r = await ai.ask({ maxTokens: 1200, system: 'Bạn là biên tập viên nội dung chuẩn SEO tiếng Việt. Chỉ trả về JSON.', prompt: `Lập dàn ý cho ${WRITER[type].label} có tiêu đề H1 "${title}" của ${brand} (lĩnh vực ${sector}). Yêu cầu thêm: ${prompt || '(không có)'}.\nTrả về JSON {"sections":[{"level":2,"heading":"...","points":"ý chính, cách nhau dấu ;","image":"mô tả ảnh minh họa phù hợp, không chữ"}]} gồm ${type === 'ZNS' || type === 'CARE_MSG' ? '2-3' : '4-7'} mục, có thể xen H3 (level 3) dưới H2.` });
      const j = r.ok ? parseAiJson<{ sections?: { level?: number; heading?: string; points?: string; image?: string }[] }>(r.text) : null;
      if (j?.sections?.length && r.ok) return { blocks: j.sections.filter((s) => s.heading).slice(0, 12).map((s) => ({ id: uid('bk'), level: s.level === 3 ? 3 : 2, heading: String(s.heading), points: String(s.points ?? ''), body: '', imagePrompt: s.image })), by: `${AI_NAME[r.provider]} · ${r.model}` };
    }
    return { blocks: localOutline(title, type, prompt), by: 'Dàn ý mẫu (chưa kết nối AI)' };
  };
  const write = async (b: ContentBlock, all: ContentBlock[], title: string, type: MktContentType, tone: string, prompt: string): Promise<{ text: string; by: string }> => {
    if (ai.available) {
      const r = await ai.ask({ maxTokens: 900, system: `Bạn viết ${WRITER[type].label} tiếng Việt cho ${brand}. Giọng văn: ${tone}. Chỉ trả về nội dung của đúng tiểu mục được yêu cầu (không lặp lại tiêu đề), 1-3 đoạn ngắn, có thể dùng gạch đầu dòng.`, prompt: `Bài: "${title}". Dàn ý: ${all.map((x) => `${x.level === 2 ? 'H2' : 'H3'} ${x.heading}`).join(' | ')}.\nYêu cầu chung: ${prompt || '(không có)'}\nViết tiểu mục "${b.heading}" với các ý: ${b.points || '(tự đề xuất)'}.` });
      if (r.ok) return { text: r.text.trim(), by: `${AI_NAME[r.provider]} · ${r.model}` };
    }
    return { text: localBlockText(b, title, company), by: 'Mẫu soạn sẵn' };
  };
  const image = async (b: ContentBlock, title: string, imgPrompt: string, aspect: ImgAspect = 'landscape', reference?: string): Promise<{ url: string; prompt: string; by: string; error?: string }> => {
    const prompt = `${b.imagePrompt || `${b.heading}. ${b.points}`}. Bối cảnh bài viết: ${title}. Lĩnh vực: ${sector}. ${imgPrompt ? `Yêu cầu hình ảnh: ${imgPrompt}.` : ''} Phong cách: ảnh chụp thương mại chân thực, ánh sáng tự nhiên, bố cục sạch, phù hợp thị trường Việt Nam, không có chữ, không có logo.`;
    if (imgOn) {
      const r = await apiPost<{ b64: string; mediaType: string; model: string }>('/api/ai/image', { tenant: org.id, prompt, aspect, ...(reference ? { reference: { mediaType: reference.slice(5, reference.indexOf(';')) || 'image/jpeg', data: reference.split(',')[1] ?? '' }, strength: 0.35 } : {}) });
      if (r.ok) return { url: await compactImage(`data:${r.mediaType};base64,${r.b64}`), prompt, by: `OpenAI · ${r.model}` };
      return { url: placeholderImage(b.heading, brand, aspect), prompt, by: 'Ảnh mẫu', error: aiErrText(r.error) };
    }
    return { url: placeholderImage(b.heading, brand, aspect), prompt, by: 'Ảnh mẫu (chưa kết nối API tạo ảnh)' };
  };
  return { analyze, outline, write, image, ai, imgOn, brand };
}

/** Bộ xử lý nền: nhận việc "Giao cho AI" từ Lịch chiến dịch, lần lượt lập dàn ý → viết → tạo ảnh → chờ duyệt */
export function AiContentWorker() {
  const app = useApp();
  const { contents, setContents, me, notify, company, skus } = app;
  ST_VARIANT_CACHE.cfg = vCfgOf(app.hubCfg.content);
  const st = useStudioAi();
  const skuRef = useRef(skus); skuRef.current = skus;
  const coRef = useRef(stCompanyOf(company)); coRef.current = stCompanyOf(company);
  const ref = useRef(st); ref.current = st;
  const running = useRef<string | null>(null);
  const job = me ? contents.find((c) => c.aiJob && c.aiJob.by === me.id && c.aiJob.status === 'QUEUED') : undefined;
  useEffect(() => {
    if (!job || running.current) return;
    running.current = job.id;
    const patch = (fn: (c: MktContent) => MktContent) => setContents((p) => p.map((x) => (x.id === job.id ? fn(x) : x)));
    const step = (s: string) => patch((c) => ({ ...c, aiJob: { ...(c.aiJob as AiJob), status: 'RUNNING', step: s } }));
    void (async () => {
      try {
        const s = ref.current;
        const co = coRef.current;
        // v38: nội dung có kênh Studio (Website / Facebook / Zalo / Maps) => soạn theo prompt của kênh + brief, giống Content Studio
        const p = job.platform ? getPlatform(job.platform) : null;
        const settings: StSettings = p ? { ...p.defaults(co), ...(job.settings ?? {}) } : {};
        let sapo = job.sapo ?? '';
        const extra = job.textPrompt ? `\nGhi chú thêm: ${job.textPrompt}` : '';
        const art = (bl: ContentBlock[]): StArticle => ({ id: job.id, platform: p?.id ?? 'website', title: job.title, sapo, settings, updatedAt: Date.now(), sections: bl.map((b) => ({ id: b.id, level: b.level, title: b.heading, body: b.body })) });
        step('Đang lập dàn ý');
        let blocks: ContentBlock[] = job.blocks?.length ? job.blocks : [];
        let by = '';
        if (!blocks.length && p && s.ai.available) {
          const r = await s.ai.ask({ maxTokens: 1400, system: 'Chỉ trả JSON hợp lệ, không giải thích.', prompt: stOutlinePrompt(p, art([]), co) + extra });
          const j = r.ok ? parseAiJson<{ sapo?: string; sections?: { level?: number; title?: string }[] }>(r.text) : null;
          if (j?.sections?.length) {
            sapo = j.sapo ?? sapo;
            blocks = j.sections.filter((x) => x.title).slice(0, p.structure.maxSections).map((x) => ({ id: uid('bk'), level: x.level === 3 ? 3 : 2, heading: String(x.title), points: '', body: '' }));
            if (r.ok) by = `${AI_NAME[r.provider]} · ${r.model}`;
          }
        }
        if (!blocks.length) blocks = (await s.outline(job.title, job.type, job.textPrompt ?? '')).blocks;
        patch((c) => ({ ...c, blocks, sapo, step: 2 }));
        for (let i = 0; i < blocks.length; i++) {
          step(`Đang viết ${i + 1}/${blocks.length}: ${blocks[i].heading}`);
          if (blocks[i].body) continue;
          let text = '';
          if (p && s.ai.available) {
            const r = await s.ai.ask({ maxTokens: 1400, system: `Bạn là biên tập viên nội dung B2B của ${co.name}${co.sector ? `, lĩnh vực ${co.sector}` : ''}. Chỉ trả nội dung mục, không lặp tiêu đề. Đoạn văn cách nhau 1 dòng trống, danh sách dùng "- ", chữ đậm dùng **…**.`, prompt: stSectionPrompt(p, art(blocks), blocks[i].id, co) + extra });
            if (r.ok) { text = r.text.trim(); by = `${AI_NAME[r.provider]} · ${r.model}`; }
          }
          if (!text) { const r = await s.write(blocks[i], blocks, job.title, job.type, job.tone ?? WRITER_TONES[0], job.textPrompt ?? ''); text = r.text; by = r.by; }
          blocks = blocks.map((x, k) => (k === i ? { ...x, body: text } : x));
          patch((c) => ({ ...c, blocks, by }));
        }
        // Điền meta title / description / slug… còn trống bằng gợi ý tự động của kênh
        if (p) for (const fd of p.fields) if (fd.suggest && !stStr(settings[fd.key]).trim()) settings[fd.key] = fd.suggest(art(blocks), settings);
        const cnt = vImg(settings, 'imgCount', p?.id);
        if (job.aiJob?.images !== false && cnt !== 'none') {
          const targets = blocks.filter((b) => b.level === 2 && !b.image).slice(0, cnt === 'hero' ? 1 : cnt === 'max3' ? 3 : 6);
          const imgExtra = [job.imagePrompt ?? '', vText(settings, p?.id, 'image')].filter(Boolean).join('. ');
          const stamp = vImg(settings, 'imgStamp', p?.id);
          const ref = stArr(settings[vKey('imgRef')]).map((id) => skuRef.current.find((x) => x.sku === id)?.image).find((u) => u?.startsWith('data:'));
          for (const [i, t] of targets.entries()) {
            step(`Đang tạo ảnh ${i + 1}/${targets.length}: ${t.heading}`);
            const im0 = await s.image(t, job.title, imgExtra, vAspect(settings, p?.id, p?.image.aspect ?? 'landscape'), ref);
            const im = stamp !== 'nostamp' && im0.url.startsWith('data:') && !im0.by.startsWith('Ảnh mẫu') ? { ...im0, url: await applyWatermark(im0.url, co.name, stamp === 'logo' ? company.logo : undefined).catch(() => im0.url) } : im0;
            const kw = stStr(settings.focusKeyword).trim();
            const img = { url: im.url, prompt: im.prompt, by: im.by, at: Date.now(), alt: stClip([t.heading, kw && !stHas(t.heading, kw) ? kw : ''].filter(Boolean).join(' – '), 125) };
            blocks = blocks.map((x) => (x.id === t.id ? { ...x, image: img, imageHistory: [img] } : x));
            patch((c) => ({ ...c, blocks }));
          }
        }
        patch((c) => ({ ...c, blocks, ...(p ? { platform: p.id, sapo, settings, doc: undefined } : {}), body: blocksToMarkdown(c.title, blocks), status: c.status === 'DRAFT' ? 'REVIEW' : c.status, step: 3, updatedAt: Date.now(), aiJob: { ...(c.aiJob as AiJob), status: 'DONE', step: undefined, at: Date.now() } }));
        patch((c) => ({ ...c, submittedBy: c.submittedBy ?? job.aiJob?.by, submittedAt: Date.now(), reviewNote: undefined }));
        app.dispatch('PROGRAM_APPROVAL', { toAll: app.users.filter((u) => u.active && (u.role === 'BOD' || u.role === 'MKT_LEAD') && u.id !== job.aiJob?.by), title: `AI soạn xong, chờ duyệt: ${job.title}`, body: 'Duyệt ở Công việc › Trung tâm phê duyệt hoặc Content Studio', module: 'tasks' });
        notify(`AI đã soạn xong “${job.title}”, chờ duyệt (Công việc › Trung tâm phê duyệt, hoặc mở bài trong Content Studio)`, 'teal');
      } catch (e) {
        patch((c) => ({ ...c, aiJob: { ...(c.aiJob as AiJob), status: 'FAILED', error: e instanceof Error ? e.message : 'Lỗi', step: undefined } }));
        notify(`AI chưa soạn được “${job.title}”`, 'red');
      } finally { running.current = null; }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);
  return null;
}

export function ContentStudio() {
  const { contents, campaigns, userName, canDo } = useApp();
  const [edit, setEdit] = useState<MktContent | null | 'new'>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useSticky<string | null>('Mkt.openContent', null);
  const [st, setSt] = useSticky<'ALL' | ContentStatus>('Mkt.cst', 'ALL');
  useEffect(() => { if (openId) { const c = contents.find((x) => x.id === openId); if (c) setEdit(c); setOpenId(null); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [openId]);
  const contentsRef = useRef(contents); contentsRef.current = contents;
  useEffect(() => {
    const f = (e: Event) => { const c = contentsRef.current.find((x) => x.id === (e as CustomEvent<string>).detail); if (c) { setEdit(c); stickyStore.delete('Mkt.openContent'); } };
    window.addEventListener(MKT_OPEN_EVT, f);
    return () => window.removeEventListener(MKT_OPEN_EVT, f);
  }, []);
  const list = contents.filter((c) => (st === 'ALL' || c.status === st) && (!q.trim() || stFold(`${c.title} ${stStr(c.settings?.focusKeyword)}`).includes(stFold(q)))).sort((a, b) => b.updatedAt - a.updatedAt);
  const exportList = () => downloadBlob(`NoiDung_${isoDay(Date.now())}.xlsx`, xlsxBlob([{ name: 'Noi dung', widths: [6, 44, 18, 16, 26, 24, 18, 14, 14], rows: [
    ['STT', 'Tiêu đề', 'Loại', 'Kênh', 'Chiến dịch', 'Từ khóa chính', 'Người soạn', 'Cập nhật', 'Trạng thái'],
    ...list.map((c, i) => [i + 1, c.title, WRITER[c.type].label, c.platform ? getPlatform(c.platform).label : c.channel ? MKT_CH[c.channel].label : '', campaigns.find((x) => x.id === c.campaignId)?.name ?? '', stStr(c.settings?.focusKeyword), userName(c.ownerId), new Date(c.updatedAt).toLocaleDateString('vi-VN'), CONTENT_STATUS[c.status].label]),
  ] }]));
  const live = edit && edit !== 'new' ? contents.find((x) => x.id === edit.id) ?? edit : edit;
  // v37: soạn mới và bài quảng cáo / PR / Zalo OA mở Studio đa kênh toàn khung; ZNS, email, tin chăm sóc giữ trình soạn cũ
  if (live && (live === 'new' || studioSupports(live))) return <section className="glass-card rounded-md p-5"><StudioWorkspace c={live === 'new' ? null : live} onClose={() => setEdit(null)} /></section>;
  return (
    <section className="glass-card rounded-md p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">{(['ALL', ...Object.keys(CONTENT_STATUS)] as ('ALL' | ContentStatus)[]).map((s) => <button key={s} onClick={() => setSt(s)} className={cn('rounded-full border px-2.5 py-1 text-xs', st === s ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.1)] text-[rgb(var(--accent-fg))]' : 'border-[rgb(var(--line))] text-[rgb(var(--muted))]')}>{s === 'ALL' ? 'Tất cả' : CONTENT_STATUS[s].label} {s === 'ALL' ? contents.length : contents.filter((c) => c.status === s).length}</button>)}</div>
        <div className="relative ml-auto"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[rgb(var(--muted))]" aria-hidden /><input className={cn(inputCls, 'h-9 w-56 py-0 pl-8')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tiêu đề, từ khóa…" aria-label="Tìm nội dung" /></div>
        <button className={cn(btnGhost, btnSm)} onClick={exportList} disabled={!list.length}><Download className="h-3.5 w-3.5" aria-hidden />Xuất Excel</button>
        {canDo('mkt.manage') && <button className={btnAccent} onClick={() => setEdit('new')}><Sparkles className="h-4 w-4" aria-hidden />Nội dung mới</button>}
      </div>
      <Table head={['Tiêu đề', 'Loại · kênh', 'Chiến dịch', 'Dàn ý · ảnh', 'Người soạn', 'Cập nhật', 'Trạng thái', '']} minW={1000}>
        {list.map((c) => (
          <tr key={c.id} className={cn(rowCls, 'cursor-pointer')} onClick={() => setEdit(c)}>
            <td className={tdFirst}><p className="max-w-[300px] truncate font-medium">{c.title || '(Chưa có tiêu đề)'}</p><p className="max-w-[300px] truncate text-[11px] text-[rgb(var(--muted))]">{c.body.replace(/^#[^\n]*\n+/, '').replace(/[#*]/g, '').slice(0, 90)}</p></td>
            <td className={tdCls}>{WRITER[c.type].label}{c.channel && <p className="text-[11px] text-[rgb(var(--muted))]">{MKT_CH[c.channel].label}</p>}</td>
            <td className={tdCls}>{campaigns.find((x) => x.id === c.campaignId)?.name ?? '—'}</td>
            <td className={cn(tdCls, 'whitespace-nowrap')}>{c.blocks?.length ? `${c.blocks.length} mục · ${c.blocks.filter((b) => b.image).length} ảnh` : '—'}</td>
            <td className={tdCls}>{userName(c.ownerId)}{c.by && <p className="text-[10px] text-[rgb(var(--muted))]">{c.by}</p>}</td>
            <td className={cn(tdCls, 'whitespace-nowrap')}>{new Date(c.updatedAt).toLocaleDateString('vi-VN')}</td>
            <td className={tdCls}><div className="flex flex-col items-end gap-1">{c.aiJob && c.aiJob.status !== 'DONE' && <Chip tone={JOB_LABEL[c.aiJob.status].tone}>{JOB_LABEL[c.aiJob.status].label}</Chip>}<Chip tone={CONTENT_STATUS[c.status].tone}>{CONTENT_STATUS[c.status].label}</Chip></div></td>
            <td className={cn(tdLast, 'w-12')} onClick={(e) => e.stopPropagation()}><ContentRowMenu c={c} onOpen={() => setEdit(c)} onConfirm={setConfirm} /></td>
          </tr>
        ))}
        {!list.length && <tr><td colSpan={8} className="py-8 text-center text-sm text-[rgb(var(--muted))]">{q.trim() ? 'Không có nội dung khớp' : <>Chưa có nội dung. Bấm “Nội dung mới” hoặc giao việc cho AI từ tab Plan.</>}</td></tr>}
      </Table>
      {live && <ContentStudioSheet c={live as MktContent} onClose={() => setEdit(null)} />}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </section>
  );
}

export function ScoreRing({ v, label, size = 64 }: { v: number; label: string; size?: number }) {
  const col = v >= 75 ? '#16A34A' : v >= 55 ? '#F59E0B' : '#EF4444';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden><circle cx="18" cy="18" r="15.5" fill="none" stroke="rgb(var(--line))" strokeWidth="3" /><circle cx="18" cy="18" r="15.5" fill="none" stroke={col} strokeWidth="3" strokeDasharray={`${(v / 100) * 97.4} 97.4`} strokeLinecap="round" /></svg>
        <span className="absolute inset-0 flex items-center justify-center font-num text-sm font-bold" style={{ color: col }}>{Math.round(v)}</span>
      </div>
      <span className="text-[11px] text-[rgb(var(--muted))]">{label}</span>
    </div>
  );
}

export function ContentStudioSheet({ c, onClose }: { c: MktContent | null; onClose: () => void }) {
  const app = useApp();
  const { setContents, campaigns, canDo, me, notify, userName, company } = app;
  const S = useStudioAi();
  const ro = !canDo('mkt.manage');
  const [f, setF] = useState<MktContent>(() => {
    const base = c ?? { id: uid('ct'), title: '', type: 'AD_POST' as MktContentType, body: '', status: 'DRAFT' as ContentStatus, ownerId: me?.id, updatedAt: Date.now() };
    return !base.blocks?.length && base.body ? { ...base, blocks: [{ id: uid('bk'), level: 2, heading: 'Nội dung', points: '', body: base.body.replace(/^#.*\n+/, '') }] } : base;
  });
  // Đồng bộ khi bộ xử lý nền đang cập nhật bản này
  useEffect(() => { if (c?.aiJob && (c.aiJob.status === 'RUNNING' || c.aiJob.status === 'DONE')) setF((p) => ({ ...p, blocks: c.blocks, body: c.body, status: c.status, aiJob: c.aiJob, by: c.by })); }, [c?.blocks, c?.aiJob?.status, c?.aiJob?.step]); // eslint-disable-line react-hooks/exhaustive-deps
  const [step, setStep] = useState<number>(() => c?.step ?? (c?.blocks?.length ? 3 : 1));
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const blocks = f.blocks ?? [];
  const set = <K extends keyof MktContent>(k: K, v: MktContent[K]) => setF((p) => ({ ...p, [k]: v }));
  const setBlocks = (fn: (b: ContentBlock[]) => ContentBlock[]) => setF((p) => ({ ...p, blocks: fn(p.blocks ?? []) }));
  const patchB = (id: string, p: Partial<ContentBlock>) => setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...p } : b)));
  const mark = (k: string, v?: string) => setBusy((p) => { const n = { ...p }; if (v) n[k] = v; else delete n[k]; return n; });
  const jobRunning = f.aiJob?.status === 'QUEUED' || f.aiJob?.status === 'RUNNING';
  const persist = (status = f.status, extra: Partial<MktContent> = {}) => {
    const v: MktContent = { ...f, ...extra, status, step, body: blocks.length ? blocksToMarkdown(f.title, blocks) : f.body, updatedAt: Date.now(), approvedBy: status === 'APPROVED' ? me?.id : f.approvedBy };
    setContents((p) => (p.some((x) => x.id === v.id) ? p.map((x) => (x.id === v.id ? v : x)) : [v, ...p]));
    return v;
  };
  const analyze = async () => { if (!f.title.trim()) return; mark('title', 'Đang phân tích…'); const r = await S.analyze(f.title, f.type, f.channel); set('titleReport', r); mark('title'); };
  const makeOutline = async () => {
    const prev = blocks;
    mark('outline', 'AI đang lập dàn ý…');
    const r = await S.outline(f.title, f.type, f.textPrompt ?? '');
    setF((p) => ({ ...p, blocks: r.blocks, by: r.by })); mark('outline'); setStep(2);
    if (prev.length) notify('Đã tạo dàn ý mới', 'teal', { label: 'Hoàn tác', run: () => setF((p) => ({ ...p, blocks: prev })) });
  };
  const writeOne = async (b: ContentBlock) => { mark(b.id, 'Đang viết…'); const r = await S.write(b, blocks, f.title, f.type, f.tone ?? WRITER_TONES[0], f.textPrompt ?? ''); patchB(b.id, { body: r.text }); set('by', r.by); mark(b.id); };
  const writeAll = async () => { for (const b of (f.blocks ?? []).filter((x) => !x.body.trim())) await writeOne(b); };
  const genImg = async (b: ContentBlock) => {
    mark(`img${b.id}`, 'Đang tạo ảnh…');
    const r = await S.image(b, f.title, f.imagePrompt ?? '');
    if (r.error) notify(`API tạo ảnh lỗi (${r.error}), dùng ảnh mẫu`, 'orange');
    const img = { url: r.url, prompt: r.prompt, by: r.by, at: Date.now() };
    setBlocks((bs) => bs.map((x) => (x.id === b.id ? { ...x, image: img, imageHistory: [img, ...(x.imageHistory ?? [])].slice(0, 4) } : x)));
    mark(`img${b.id}`);
  };
  const imgAllH2 = async () => { for (const b of (f.blocks ?? []).filter((x) => x.level === 2 && !x.image)) await genImg(b); };
  const upload = async (b: ContentBlock, file?: File) => { if (!file) return; const url = await shrinkImage(file, 1280); const img = { url, prompt: 'Ảnh tải lên', by: me?.name ?? '', at: Date.now() }; patchB(b.id, { image: img, imageHistory: [img, ...(b.imageHistory ?? [])].slice(0, 4) }); };
  const move = (from: number, to: number) => setBlocks((bs) => { if (to < 0 || to >= bs.length) return bs; const n = [...bs]; const [x] = n.splice(from, 1); n.splice(to, 0, x); return n; });
  const words = blocks.reduce((s, b) => s + b.body.split(/\s+/).filter(Boolean).length, 0);
  const canGo = (i: number) => i === 1 || (i === 2 && !!f.title.trim()) || (i >= 3 && blocks.length > 0);
  const tr = f.titleReport;
  const camp = campaigns.find((x) => x.id === f.campaignId);
  const footer = ro ? <button className={btnGhost} onClick={onClose}>Đóng</button> : (
    <>
      {c && step === 1 && <button className={cn(btnGhost, 'mr-auto text-[rgb(var(--danger-fg))]')} onClick={() => { setContents((p) => p.filter((x) => x.id !== f.id)); onClose(); }}>Xóa</button>}
      {step > 1 && <button className={cn(btnGhost, step !== 1 && 'mr-auto')} onClick={() => setStep(step - 1)}><ChevronLeft className="h-4 w-4" aria-hidden />Quay lại</button>}
      <button className={btnGhost} disabled={!f.title.trim()} onClick={() => { persist(f.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'); notify('Đã lưu nháp', 'teal'); }}>Lưu nháp</button>
      {step === 1 && <button className={btnPrimary} disabled={!f.title.trim() || !!busy.outline} onClick={() => (blocks.length ? setStep(2) : void makeOutline())}>{busy.outline ?? (blocks.length ? 'Tiếp: Dàn ý' : 'Tạo dàn ý bằng AI')}<ChevronRight className="h-4 w-4" aria-hidden /></button>}
      {step === 2 && <button className={btnPrimary} disabled={!blocks.length} onClick={() => { setStep(3); if (!blocks.some((b) => b.body.trim())) void writeAll(); }}>Viết nội dung<ChevronRight className="h-4 w-4" aria-hidden /></button>}
      {step === 3 && <button className={btnPrimary} onClick={() => setStep(4)}>Xem trước<ChevronRight className="h-4 w-4" aria-hidden /></button>}
      {step === 4 && f.status === 'DRAFT' && <button className={btnPrimary} disabled={!blocks.some((b) => b.body.trim())} onClick={() => { persist('REVIEW'); notify('Đã gửi duyệt', 'teal'); onClose(); }}>Gửi duyệt</button>}
      {step === 4 && f.status === 'REVIEW' && <button className={btnPrimary} onClick={() => { persist('APPROVED'); notify('Đã duyệt nội dung', 'teal'); onClose(); }}>Duyệt</button>}
      {step === 4 && f.status === 'APPROVED' && <button className={btnPrimary} onClick={() => { persist('PUBLISHED'); notify('Đã đánh dấu đã đăng', 'teal'); onClose(); }}>Đánh dấu đã đăng</button>}
    </>
  );
  return (
    <SideSheet title="AI Content & Visual Studio" sub={`${S.ai.available ? `Văn bản: ${S.ai.label}` : 'Văn bản: mẫu soạn sẵn (chưa kết nối AI)'} · ${S.imgOn ? 'Ảnh: OpenAI Images' : 'Ảnh: ảnh mẫu (chưa kết nối API tạo ảnh)'}`} onClose={onClose} width="sm:w-[1000px] sm:max-w-[100vw]" footer={footer}>
      <ol className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Các bước">
        {STUDIO_STEPS.map((s, i) => { const n = i + 1; const on = step === n; const done = step > n; return (
          <li key={s}><button disabled={!canGo(n)} onClick={() => setStep(n)} aria-current={on ? 'step' : undefined} className={cn('flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors disabled:opacity-40', on ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.08)] text-[rgb(var(--accent-fg))]' : 'border-[rgb(var(--line))] text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')}>
            <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', on ? 'bg-[rgb(var(--accent))] text-white' : done ? 'bg-[rgb(var(--success))] text-white' : 'bg-[rgb(var(--ink)/0.08)]')}>{done ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : n}</span>{s}
          </button></li>
        ); })}
      </ol>
      {jobRunning && <p className="mb-4 flex items-center gap-2 rounded-md bg-[#FEF9C3] px-3 py-2 text-sm text-[#713F12]"><RefreshCw className="h-4 w-4 motion-safe:animate-spin" aria-hidden />{f.aiJob?.step ?? 'Chờ AI xử lý'}… (được giao từ Plan, có thể đóng cửa sổ, AI vẫn chạy tiếp)</p>}
      {f.aiJob?.status === 'FAILED' && <p className="mb-4 rounded-md bg-[rgb(var(--danger)/0.1)] px-3 py-2 text-sm text-[rgb(var(--danger-fg))]">AI lỗi: {f.aiJob.error}. Có thể làm tiếp thủ công từng bước.</p>}
      <fieldset disabled={ro || jobRunning} className="min-w-0">
        {step === 1 && (
          <div className="grid gap-5 lg:grid-cols-[1fr_340px] [&>*]:min-w-0">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Loại nội dung"><select className={inputCls} value={f.type} onChange={(e) => set('type', e.target.value as MktContentType)}>{(Object.keys(WRITER) as WriterPreset[]).map((k) => <option key={k} value={k}>{WRITER[k].label}</option>)}</select></Field>
                <Field label="Kênh phân phối"><select className={inputCls} value={f.channel ?? ''} onChange={(e) => set('channel', (e.target.value || undefined) as MktChannel | undefined)}><option value="">—</option>{(Object.keys(MKT_CH) as MktChannel[]).map((k) => <option key={k} value={k}>{MKT_CH[k].label}</option>)}</select></Field>
                <Field label="Chiến dịch"><select className={inputCls} value={f.campaignId ?? ''} onChange={(e) => set('campaignId', e.target.value || undefined)}><option value="">Không gắn</option>{campaigns.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
              </div>
              <Field label="Tiêu đề (H1)">
                <div className="flex gap-2">
                  <input className={cn(inputCls, 'min-w-0 flex-1 text-base font-semibold')} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="VD: Đầu cáp co nguội 24kV cho trạm biến áp" />
                  <button type="button" className={cn(btnGhost, 'shrink-0')} disabled={!f.title.trim() || !!busy.title} onClick={() => void analyze()}><Gauge className="h-4 w-4 text-[rgb(var(--accent))]" aria-hidden />{busy.title ? 'Đang phân tích…' : 'Phân tích'}</button>
                </div>
              </Field>
              <Field label="Yêu cầu nội dung (prompt)" hint="Đối tượng đọc, thông điệp chính, ưu đãi, từ khóa SEO…"><textarea className={cn(inputCls, 'min-h-[88px]')} value={f.textPrompt ?? ''} onChange={(e) => set('textPrompt', e.target.value)} placeholder={camp?.goal ?? ''} /></Field>
              <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                <Field label="Yêu cầu hình ảnh (prompt)" hint="Phong cách, bối cảnh, màu sắc chung cho ảnh minh họa"><textarea className={cn(inputCls, 'min-h-[64px]')} value={f.imagePrompt ?? ''} onChange={(e) => set('imagePrompt', e.target.value)} placeholder="VD: ảnh công trình thực tế, tông xanh navy, kỹ thuật viên đội mũ bảo hộ" /></Field>
                <Field label="Giọng văn"><select className={inputCls} value={f.tone ?? WRITER_TONES[0]} onChange={(e) => set('tone', e.target.value)}>{WRITER_TONES.map((x) => <option key={x}>{x}</option>)}</select></Field>
              </div>
            </div>
            <aside className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--sunken)/0.6)] p-4" aria-label="Kết quả phân tích tiêu đề">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Gauge className="h-4 w-4 text-[rgb(var(--accent))]" aria-hidden />Phân tích tiêu đề</h3>
              {!tr ? <p className="text-sm text-[rgb(var(--muted))]">Nhập tiêu đề rồi bấm <b>Phân tích</b> để nhận điểm hấp dẫn, đánh giá SEO / mạng xã hội và 3 gợi ý tiêu đề tốt hơn.</p> : (
                <div className="space-y-3">
                  <div className="flex justify-around"><ScoreRing v={tr.score} label="Hấp dẫn" size={72} /><ScoreRing v={tr.seo.score} label="SEO" /><ScoreRing v={tr.social.score} label="Social" /></div>
                  {[['SEO', tr.seo.notes], ['Mạng xã hội', tr.social.notes], ['Nên cải thiện', tr.tips]].filter(([, n]) => (n as string[]).length).map(([l, n]) => (
                    <div key={l as string}><p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">{l as string}</p><ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-xs">{(n as string[]).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                  ))}
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">Gợi ý tiêu đề (bấm để dùng)</p>
                    <div className="space-y-1.5">{tr.suggestions.map((s) => <button type="button" key={s} onClick={() => setF((p) => ({ ...p, title: s, titleReport: undefined }))} className="block w-full rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-3 py-2 text-left text-sm hover:border-[rgb(var(--accent))]">{s}</button>)}</div>
                  </div>
                  <p className="text-[10px] text-[rgb(var(--faint))]">{tr.by}</p>
                </div>
              )}
            </aside>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-[rgb(var(--muted))]">Kéo thả khối để sắp xếp, sửa tiêu đề và ý chính, thêm / xóa mục trước khi viết.</p>
              <button type="button" className={cn(btnGhost, btnSm, 'ml-auto')} onClick={() => void makeOutline()} disabled={!!busy.outline}><RefreshCw className="h-3.5 w-3.5" aria-hidden />{busy.outline ?? 'Tạo lại dàn ý'}</button>
            </div>
            <div className="rounded-md border-2 border-[rgb(var(--accent)/0.4)] bg-[rgb(var(--accent)/0.05)] px-4 py-3"><span className="mr-2 rounded bg-[rgb(var(--accent))] px-1.5 py-0.5 text-[10px] font-bold text-white">H1</span><input className="w-[calc(100%-3rem)] bg-transparent text-lg font-bold focus:outline-none" value={f.title} onChange={(e) => set('title', e.target.value)} aria-label="Tiêu đề H1" /></div>
            <ol className="space-y-2">
              {blocks.map((b, i) => (
                <li key={b.id} draggable onDragStart={() => setDragId(b.id)} onDragEnd={() => setDragId(null)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId) move(blocks.findIndex((x) => x.id === dragId), i); setDragId(null); }}
                  className={cn('flex gap-2 rounded-md border bg-[rgb(var(--surface))] p-3', b.level === 3 && 'ml-8', dragId === b.id ? 'border-[rgb(var(--accent))] opacity-60' : 'border-[rgb(var(--line))]')}>
                  <span className="mt-2 cursor-grab text-[rgb(var(--faint))]" title="Kéo để sắp xếp" aria-hidden><GripVertical className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <select className={cn(inputBase, 'h-8 w-16 py-0 text-xs font-bold')} value={b.level} onChange={(e) => patchB(b.id, { level: Number(e.target.value) as 2 | 3 })} aria-label="Cấp tiêu đề"><option value={2}>H2</option><option value={3}>H3</option></select>
                      <input className={cn(inputCls, 'h-9 py-1 font-semibold')} value={b.heading} onChange={(e) => patchB(b.id, { heading: e.target.value })} aria-label="Tiêu đề mục" />
                    </div>
                    <textarea className={cn(inputCls, 'min-h-[44px] text-xs')} value={b.points} onChange={(e) => patchB(b.id, { points: e.target.value })} placeholder="Ý chính của mục, cách nhau dấu ;" aria-label="Ý chính" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <button type="button" className="rounded p-1 hover:bg-[rgb(var(--ink)/0.06)] disabled:opacity-30" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Lên"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" className="rounded p-1 hover:bg-[rgb(var(--ink)/0.06)] disabled:opacity-30" disabled={i === blocks.length - 1} onClick={() => move(i, i + 1)} aria-label="Xuống"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button type="button" className="rounded p-1 text-[rgb(var(--danger-fg))] hover:bg-[rgb(var(--ink)/0.06)]" onClick={() => setBlocks((bs) => bs.filter((x) => x.id !== b.id))} aria-label="Xóa mục"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex gap-2">
              <button type="button" className={cn(btnGhost, btnSm)} onClick={() => setBlocks((bs) => [...bs, { id: uid('bk'), level: 2, heading: 'Mục mới', points: '', body: '' }])}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm H2</button>
              <button type="button" className={cn(btnGhost, btnSm)} onClick={() => setBlocks((bs) => [...bs, { id: uid('bk'), level: 3, heading: 'Mục con', points: '', body: '' }])}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm H3</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 bg-[rgb(var(--raised))] px-1 py-2">
              <button type="button" className={cn(btnAccent, btnSm)} onClick={() => void writeAll()} disabled={Object.keys(busy).length > 0}><Sparkles className="h-3.5 w-3.5" aria-hidden />Viết các mục còn trống</button>
              <button type="button" className={cn(btnGhost, btnSm)} onClick={() => void imgAllH2()} disabled={Object.keys(busy).length > 0}><ImagePlus className="h-3.5 w-3.5" aria-hidden />Tạo ảnh cho mọi H2</button>
              <span className="ml-auto text-xs text-[rgb(var(--muted))]">{words} từ · {blocks.filter((b) => b.image).length} ảnh{Object.values(busy)[0] ? ` · ${Object.values(busy)[0]}` : ''}</span>
            </div>
            {blocks.map((b) => (
              <article key={b.id} className={cn('rounded-md border border-[rgb(var(--line))] p-4', b.level === 3 && 'ml-6')}>
                <div className="mb-2 flex items-center gap-2"><span className="rounded bg-[rgb(var(--ink)/0.08)] px-1.5 py-0.5 text-[10px] font-bold">H{b.level}</span><h3 className={cn('min-w-0 flex-1 font-semibold', b.level === 2 ? 'text-base' : 'text-sm')}>{b.heading}</h3>
                  <button type="button" className={cn(btnGhost, btnSm)} onClick={() => void writeOne(b)} disabled={!!busy[b.id]}><Sparkles className="h-3.5 w-3.5 text-[rgb(var(--accent))]" aria-hidden />{busy[b.id] ?? (b.body ? 'Viết lại' : 'Viết đoạn này')}</button>
                </div>
                {/* Ảnh minh họa chèn ngay dưới tiểu mục */}
                {b.image ? (
                  <figure className="mb-3">
                    <button type="button" className="block w-full overflow-hidden rounded-md border border-[rgb(var(--line))]" onClick={() => setZoom(zoom === b.id ? null : b.id)} title={zoom === b.id ? 'Thu nhỏ' : 'Xem lớn'}>
                      <img src={b.image.url} alt={b.heading} className={cn('w-full object-cover', zoom === b.id ? 'max-h-none' : 'max-h-64')} />
                    </button>
                    <figcaption className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[rgb(var(--muted))]">
                      <span className="mr-auto">{b.image.by}</span>
                      {(b.imageHistory ?? []).length > 1 && (b.imageHistory ?? []).map((h, k) => <button type="button" key={k} onClick={() => patchB(b.id, { image: h })} className={cn('h-8 w-12 overflow-hidden rounded border', h.url === b.image?.url ? 'border-[rgb(var(--accent))]' : 'border-[rgb(var(--line))]')} aria-label={`Dùng ảnh phương án ${k + 1}`}><img src={h.url} alt="" className="h-full w-full object-cover" /></button>)}
                      <button type="button" className={cn(btnGhost, btnSm)} onClick={() => void genImg(b)} disabled={!!busy[`img${b.id}`]}><RefreshCw className="h-3 w-3" aria-hidden />{busy[`img${b.id}`] ?? 'Tạo lại'}</button>
                      <label className={cn(btnGhost, btnSm, 'cursor-pointer')}><Upload className="h-3 w-3" aria-hidden />Đổi ảnh<input type="file" accept="image/*" className="sr-only" onChange={(e) => void upload(b, e.target.files?.[0])} /></label>
                      <button type="button" className={cn(btnGhost, btnSm)} onClick={() => setPromptOpen(promptOpen === b.id ? null : b.id)}>Mô tả ảnh</button>
                      <button type="button" className={cn(btnGhost, btnSm, 'text-[rgb(var(--danger-fg))]')} onClick={() => patchB(b.id, { image: undefined })}>Bỏ ảnh</button>
                    </figcaption>
                  </figure>
                ) : (
                  <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-[rgb(var(--line))] px-3 py-2.5">
                    <button type="button" className={cn(btnGhost, btnSm)} onClick={() => void genImg(b)} disabled={!!busy[`img${b.id}`]}><ImagePlus className="h-3.5 w-3.5 text-[rgb(var(--accent))]" aria-hidden />{busy[`img${b.id}`] ?? 'Tạo ảnh minh họa bằng AI'}</button>
                    <label className={cn(btnGhost, btnSm, 'cursor-pointer')}><Upload className="h-3.5 w-3.5" aria-hidden />Tải ảnh lên<input type="file" accept="image/*" className="sr-only" onChange={(e) => void upload(b, e.target.files?.[0])} /></label>
                    <button type="button" className="text-xs text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => setPromptOpen(promptOpen === b.id ? null : b.id)}>Sửa mô tả ảnh</button>
                    {busy[`img${b.id}`] && <span className="h-1 flex-1 overflow-hidden rounded-full bg-[rgb(var(--line))]"><span className="block h-1 w-1/3 rounded-full bg-[rgb(var(--accent))] motion-safe:animate-pulse" /></span>}
                  </div>
                )}
                {promptOpen === b.id && <textarea className={cn(inputCls, 'mb-3 min-h-[56px] text-xs')} value={b.imagePrompt ?? `${b.heading}. ${b.points}`} onChange={(e) => patchB(b.id, { imagePrompt: e.target.value })} aria-label="Mô tả ảnh minh họa" />}
                <textarea className={cn(inputCls, 'min-h-[110px] text-sm leading-relaxed')} value={b.body} onChange={(e) => patchB(b.id, { body: e.target.value })} placeholder={busy[b.id] ? 'AI đang viết…' : 'Nội dung mục này'} aria-label={`Nội dung ${b.heading}`} />
              </article>
            ))}
          </div>
        )}
      </fieldset>

      {step === 4 && (
        <div className="grid gap-5 lg:grid-cols-[1fr_260px] [&>*]:min-w-0">
          <article className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-6 py-5">
            <h1 className="mb-4 font-display text-2xl font-bold leading-tight">{f.title}</h1>
            {blocks.map((b) => (
              <section key={b.id} className="mb-4">
                {b.level === 2 ? <h2 className="mb-2 text-lg font-bold">{b.heading}</h2> : <h3 className="mb-1.5 text-base font-semibold">{b.heading}</h3>}
                {b.image && <img src={b.image.url} alt={b.heading} className="mb-2 w-full rounded-md" />}
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{b.body || <i className="text-[rgb(var(--faint))]">Chưa có nội dung</i>}</div>
              </section>
            ))}
          </article>
          <aside className="space-y-3 text-sm">
            <div className="rounded-md border border-[rgb(var(--line))] p-3">
              <p className="text-xs text-[rgb(var(--muted))]">Trạng thái</p><Chip tone={CONTENT_STATUS[f.status].tone}>{CONTENT_STATUS[f.status].label}</Chip>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-[rgb(var(--muted))]">Số từ</dt><dd className="font-num font-semibold">{words}</dd></div><div><dt className="text-[rgb(var(--muted))]">Mục / ảnh</dt><dd className="font-num font-semibold">{blocks.length} / {blocks.filter((b) => b.image).length}</dd></div>{tr && <div><dt className="text-[rgb(var(--muted))]">Điểm tiêu đề</dt><dd className="font-num font-semibold">{tr.score}</dd></div>}<div><dt className="text-[rgb(var(--muted))]">Người soạn</dt><dd>{userName(f.ownerId)}</dd></div></dl>
              {f.approvedBy && <p className="mt-2 text-xs text-[rgb(var(--muted))]">Duyệt bởi {userName(f.approvedBy)}</p>}
            </div>
            <button className={cn(btnGhost, 'w-full')} onClick={() => { void navigator.clipboard?.writeText(blocksToMarkdown(f.title, blocks)); notify('Đã sao chép nội dung (Markdown)', 'teal'); }}><Copy className="h-4 w-4" aria-hidden />Sao chép văn bản</button>
            <button className={cn(btnGhost, 'w-full')} onClick={() => downloadBlob(`${fold(f.title).replace(/[^a-z0-9]+/g, '-').slice(0, 60) || 'bai-viet'}.html`, new Blob([blocksToHtml(f.title, blocks)], { type: 'text/html' }))}><Download className="h-4 w-4" aria-hidden />Tải HTML (kèm ảnh)</button>
            <p className="text-[11px] text-[rgb(var(--muted))]">{company.shortName || company.appName}: “Gửi duyệt” chuyển cho Trưởng Marketing / Giám đốc; nội dung đã duyệt mới đánh dấu đăng.</p>
          </aside>
        </div>
      )}
    </SideSheet>
  );
}

/** Trạng thái thực tế: suy ra từ nội dung AI đã sinh (nếu có), không để lệch giữa Lịch và Content Studio */
export function taskStatusOf(t: MktTask, contents: MktContent[]): TaskStatus {
  const c = contents.find((x) => x.id === t.contentId);
  if (!c) return t.status === 'PUBLISHED' ? 'PUBLISHED' : 'PLAN';
  if (c.status === 'PUBLISHED') return 'PUBLISHED';
  if (c.status === 'APPROVED') return 'APPROVED';
  if (c.aiJob && (c.aiJob.status === 'QUEUED' || c.aiJob.status === 'RUNNING')) return 'AI_QUEUED';
  if (c.status === 'REVIEW' || c.aiJob?.status === 'DONE') return 'AI_DONE';
  return c.aiJob?.status === 'FAILED' ? 'AI_QUEUED' : 'PLAN';
}

/** Giao việc cho AI: tạo bản nội dung gắn nhiệm vụ, đưa vào hàng đợi của bộ xử lý nền */
export function useAssignToAi() {
  const { setContents, setMktTasks, me, notify, contents } = useApp();
  return (t: MktTask) => {
    const ex = contents.find((c) => c.id === t.contentId);
    const id = ex?.id ?? uid('ct');
    const job: AiJob = { status: 'QUEUED', by: me?.id ?? '', at: Date.now(), images: true };
    const pid = t.platform ?? ST_OF_CHANNEL[t.channel];
    const seo = pid ? { platform: pid, settings: t.settings ?? {} } : {};
    // Giao lại: bỏ dàn ý / nội dung cũ để AI soạn theo thông số mới (bản cũ vẫn còn trong Lịch sử phiên bản nếu đã lưu mốc)
    if (ex) setContents((p) => p.map((c) => (c.id === id ? { ...c, ...seo, title: t.title, textPrompt: t.textPrompt, imagePrompt: t.imagePrompt, blocks: [], doc: undefined, sapo: '', status: c.status === 'PUBLISHED' ? c.status : 'DRAFT', reviewNote: undefined, aiJob: job } : c)));
    else setContents((p) => [{ id, title: t.title, type: t.contentType, channel: t.channel, campaignId: t.campaignId, taskId: t.id, textPrompt: t.textPrompt, imagePrompt: t.imagePrompt, body: '', status: 'DRAFT', ownerId: t.ownerId ?? me?.id, updatedAt: Date.now(), aiJob: job, ...seo }, ...p]);
    setMktTasks((p) => p.map((x) => (x.id === t.id ? { ...x, contentId: id } : x)));
    notify(`Đã giao “${t.title}” cho AI. Theo dõi trạng thái trên lịch, kết quả ở Content Studio.`, 'teal');
  };
}

export function CampaignCalendar() {
  const { campaigns, mktTasks, contents, canDo, now, userName, me } = useApp();
  const assign = useAssignToAi();
  const [ym, setYm] = useSticky('Mkt.ym', isoDay(now ?? Date.now()).slice(0, 7));
  const [view, setView] = useSticky<CalView>('Mkt.calView', 'calendar');
  const [edit, setEdit] = useState<Campaign | null | 'new'>(null);
  const [task, setTask] = useState<MktTask | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [stF, setStF] = useSticky<'ALL' | TaskStatus>('Mkt.taskSt', 'ALL');
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const startOff = (first.getDay() + 6) % 7;
  const daysIn = new Date(y, m, 0).getDate();
  const cells = Array.from({ length: Math.ceil((startOff + daysIn) / 7) * 7 }, (_, i) => { const d = i - startOff + 1; return d >= 1 && d <= daysIn ? `${ym}-${String(d).padStart(2, '0')}` : null; });
  const shift = (k: number) => { const d = new Date(y, m - 1 + k, 1); setYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); };
  const today = isoDay(now ?? Date.now());
  const canEdit = canDo('mkt.manage');
  const neu = (date: string): MktTask => ({ id: uid('tk'), date, title: '', channel: 'FACEBOOK', contentType: 'AD_POST', textPrompt: '', imagePrompt: '', status: 'PLAN', ownerId: me?.id, createdAt: Date.now() });
  const monthTasks = mktTasks.filter((t) => t.date.startsWith(ym)).sort((a, b) => a.date.localeCompare(b.date));
  const rows = monthTasks.map((t) => ({ t, st: taskStatusOf(t, contents) })).filter((r) => stF === 'ALL' || r.st === stF);
  const counts = (Object.keys(TASK_STATUS) as TaskStatus[]).map((s) => [s, monthTasks.filter((t) => taskStatusOf(t, contents) === s).length] as const);
  const chip = (t: MktTask) => { const s = TASK_STATUS[taskStatusOf(t, contents)]; return (
    <button key={t.id} onClick={(e) => { e.stopPropagation(); setTask(t); }} className="mb-0.5 flex w-full items-center gap-1 truncate rounded border-l-[3px] px-1.5 py-0.5 text-left text-[11px] font-medium" style={{ background: s.bg, color: s.fg, borderColor: s.color }} title={`${t.title} · ${s.label}`}>
      <span className="truncate">{t.title || '(chưa đặt tên)'}</span>
    </button>
  ); };
  const exportXlsx = () => {
    const data: (string | number)[][] = [['STT', 'Ngày', 'Tiêu đề', 'Chiến dịch', 'Kênh', 'Loại nội dung', 'Yêu cầu nội dung', 'Yêu cầu hình ảnh / video', 'Phụ trách', 'Trạng thái'],
      ...rows.map(({ t, st }, i) => [i + 1, fmtDate(t.date), t.title, campaigns.find((c) => c.id === t.campaignId)?.name ?? '', MKT_CH[t.channel].label, WRITER[t.contentType].label, t.textPrompt, t.imagePrompt, userName(t.ownerId), TASK_STATUS[st].label])];
    downloadBlob(`KeHoach_NoiDung_${ym}.xlsx`, xlsxBlob([{ name: `Ke hoach ${ym}`, rows: data, widths: [6, 12, 40, 26, 14, 18, 44, 40, 18, 18] }]));
  };
  return (
    <section className="glass-card rounded-md">
      <div className="flex flex-wrap items-center gap-2 border-b border-[rgb(var(--line))] px-5 py-3">
        <button className={cn(btnGhost, 'h-9 w-9 p-0')} onClick={() => shift(-1)} aria-label="Tháng trước"><ChevronLeft className="h-4 w-4" /></button>
        <h2 className="min-w-[120px] text-center text-[15px] font-semibold">Tháng {m}/{y}</h2>
        <button className={cn(btnGhost, 'h-9 w-9 p-0')} onClick={() => shift(1)} aria-label="Tháng sau"><ChevronRight className="h-4 w-4" /></button>
        <button className={cn(btnGhost, btnSm)} onClick={() => setYm(today.slice(0, 7))}>Hôm nay</button>
        <div className="flex rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--sunken))] p-0.5" role="radiogroup" aria-label="Chế độ xem">
          {([['calendar', 'Lịch tháng', CalendarDays], ['list', 'Danh sách', List], ['board', 'Bảng', Columns3]] as const).map(([v, l, I]) => <button key={v} role="radio" aria-checked={view === v} onClick={() => setView(v)} className={cn('flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium', view === v ? 'bg-[rgb(var(--surface))] text-[rgb(var(--fg))] shadow-sm' : 'text-[rgb(var(--muted))]')}><I className="h-3.5 w-3.5" aria-hidden />{l}</button>)}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button className={cn(btnGhost, btnSm)} onClick={exportXlsx} disabled={!rows.length} title={`Xuất ${rows.length} nhiệm vụ tháng ${m}/${y}`}><Download className="h-3.5 w-3.5" aria-hidden />Xuất Excel</button>
          {canEdit && <button className={btnGhost} onClick={() => setEdit('new')}><Plus className="h-4 w-4" aria-hidden />Chiến dịch</button>}
          {canEdit && <button className={btnAccent} onClick={() => setTask(neu(today.startsWith(ym) ? today : `${ym}-01`))}><Plus className="h-4 w-4" aria-hidden />Nhiệm vụ nội dung</button>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-[rgb(var(--line))] px-5 py-2 text-xs">
        <button onClick={() => setStF('ALL')} className={cn('rounded-full border px-2.5 py-1', stF === 'ALL' ? 'border-[rgb(var(--accent))] text-[rgb(var(--accent-fg))]' : 'border-[rgb(var(--line))] text-[rgb(var(--muted))]')}>Tất cả {monthTasks.length}</button>
        {counts.map(([s, n]) => <button key={s} onClick={() => setStF(s)} className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1', stF === s ? 'border-[rgb(var(--fg)/0.5)]' : 'border-[rgb(var(--line))]')} style={{ background: TASK_STATUS[s].bg, color: TASK_STATUS[s].fg }}><span className="h-2 w-2 rounded-full" style={{ background: TASK_STATUS[s].color }} aria-hidden />{TASK_STATUS[s].label} {n}</button>)}
        <span className="ml-auto text-[rgb(var(--muted))]">{view === 'calendar' ? 'Bấm vào một ngày để thêm nhiệm vụ; thanh mảnh phía trên là chiến dịch' : 'Trạng thái tự cập nhật theo tiến độ AI và Content Studio'}</span>
      </div>

      {view === 'calendar' && (
        <div className="overflow-x-auto">
          <div className="grid min-w-[760px] grid-cols-7 text-xs">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => <div key={d} className="border-b border-[rgb(var(--line))] px-2 py-2 text-center font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">{d}</div>)}
            {cells.map((d, i) => {
              const camps = d ? campaigns.filter((c) => c.start <= d && c.end >= d) : [];
              const ts = d ? rows.filter((r) => r.t.date === d).map((r) => r.t) : [];
              return (
                <div key={i} role={d && canEdit ? 'button' : undefined} tabIndex={d && canEdit ? 0 : undefined} onClick={() => d && canEdit && setTask(neu(d))} onKeyDown={(e) => { if (d && canEdit && e.key === 'Enter') setTask(neu(d)); }}
                  className={cn('group min-h-[118px] border-b border-r border-[rgb(var(--line)/0.7)] p-1.5', !d && 'bg-[rgb(var(--ink)/0.02)]', d && canEdit && 'cursor-pointer hover:bg-[rgb(var(--secondary)/0.04)]', d === today && 'bg-[rgb(var(--accent)/0.06)]')} aria-label={d ? `Ngày ${fmtDate(d)}: ${ts.length} nhiệm vụ` : undefined}>
                  {d && <div className="mb-1 flex items-center"><span className="hidden text-[10px] text-[rgb(var(--accent-fg))] group-hover:inline">{canEdit ? '+ Thêm' : ''}</span><p className={cn('ml-auto text-[11px] font-semibold', d === today ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--muted))]')}>{Number(d.slice(8))}</p></div>}
                  {camps.slice(0, 2).map((c) => <button key={c.id} onClick={(e) => { e.stopPropagation(); setEdit(c); }} className="mb-0.5 block h-1 w-full rounded-full" style={{ background: MKT_CH[c.channels[0] ?? 'EVENT'].color, opacity: 0.35 }} title={`Chiến dịch: ${c.name}`} aria-label={`Chiến dịch ${c.name}`} />)}
                  {ts.slice(0, 3).map(chip)}
                  {ts.length > 3 && <p className="text-[10px] text-[rgb(var(--muted))]">+{ts.length - 3} nhiệm vụ</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'list' && (
        <div className="px-5 py-4">
          <Table head={['Ngày', 'Tiêu đề · chiến dịch', 'Kênh', 'Loại', 'Yêu cầu nội dung', 'Yêu cầu hình ảnh', 'Phụ trách', 'Trạng thái', 'Thao tác']} minW={1240}>
            {rows.map(({ t, st }) => (
              <tr key={t.id} className={cn(rowCls, 'cursor-pointer')} onClick={() => setTask(t)}>
                <td className={cn(tdFirst, 'whitespace-nowrap')}>{fmtDate(t.date)}</td>
                <td className={tdCls}><p className="max-w-[240px] truncate font-medium">{t.title}</p><p className="max-w-[240px] truncate text-[11px] text-[rgb(var(--muted))]">{campaigns.find((c) => c.id === t.campaignId)?.name ?? '—'}</p></td>
                <td className={tdCls}><span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: MKT_CH[t.channel].color }}>{MKT_CH[t.channel].label}</span></td>
                <td className={cn(tdCls, 'whitespace-nowrap')}>{WRITER[t.contentType].label}</td>
                <td className={tdCls}><p className="line-clamp-2 max-w-[220px] text-xs">{t.textPrompt || '—'}</p></td>
                <td className={tdCls}><p className="line-clamp-2 max-w-[200px] text-xs">{t.imagePrompt || '—'}</p></td>
                <td className={tdCls}>{userName(t.ownerId)}</td>
                <td className={tdCls}><span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: TASK_STATUS[st].bg, color: TASK_STATUS[st].fg }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: TASK_STATUS[st].color }} aria-hidden />{TASK_STATUS[st].label}</span></td>
                <td className={tdLast} onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-end gap-1">{canEdit && st === 'PLAN' && t.title.trim() && <button className={cn(btnGhost, btnSm)} onClick={() => assign(t)}><Sparkles className="h-3.5 w-3.5 text-[rgb(var(--accent))]" aria-hidden />Giao AI</button>}<TaskRowMenu t={t} onEdit={() => setTask(t)} onConfirm={setConfirm} /></div></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="py-8 text-center text-sm text-[rgb(var(--muted))]">Chưa có nhiệm vụ trong tháng</td></tr>}
          </Table>
        </div>
      )}

      {view === 'board' && (
        <div className="grid gap-3 overflow-x-auto p-4 md:grid-cols-4">
          {(Object.keys(TASK_STATUS) as TaskStatus[]).map((s) => { const col = rows.filter((r) => r.st === s); return (
            <div key={s} className="min-w-[220px] rounded-md bg-[rgb(var(--sunken))] p-2">
              <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: TASK_STATUS[s].color }} aria-hidden />{TASK_STATUS[s].label}<span className="ml-auto text-[rgb(var(--muted))]">{col.length}</span></p>
              <div className="space-y-2">{col.map(({ t }) => { const c = contents.find((x) => x.id === t.contentId); return (
                <button key={t.id} onClick={() => setTask(t)} className="block w-full rounded-md border border-[rgb(var(--line))] border-l-4 bg-[rgb(var(--surface))] p-2.5 text-left shadow-sm hover:border-[rgb(var(--secondary)/0.6)]" style={{ borderLeftColor: TASK_STATUS[s].color }}>
                  <p className="text-[11px] text-[rgb(var(--muted))]">{fmtDate(t.date)} · {MKT_CH[t.channel].label}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm font-medium">{t.title}</p>
                  {c?.aiJob?.step && <p className="mt-1 truncate text-[11px] text-[#713F12]">{c.aiJob.step}</p>}
                  {c?.blocks?.length ? <p className="mt-1 text-[11px] text-[rgb(var(--muted))]">{c.blocks.length} mục · {c.blocks.filter((b) => b.image).length} ảnh</p> : null}
                </button>
              ); })}{!col.length && <p className="px-1 py-4 text-center text-[11px] text-[rgb(var(--faint))]">Trống</p>}</div>
            </div>
          ); })}
        </div>
      )}
      {edit && <CampaignSheet c={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      {task && <TaskSheet t={task} onClose={() => setTask(null)} />}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </section>
  );
}

export function CampaignRoi() {
  const { campaigns, myLeads, jobs } = useApp();
  const [edit, setEdit] = useState<Campaign | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const rows = campaigns.map((c) => ({ c, s: campaignStats(c, myLeads, jobs) }));
  const byCh = (Object.keys(MKT_CH) as MktChannel[]).map((ch) => {
    const rs = rows.filter((r) => r.c.channels.includes(ch));
    const share = (r: typeof rows[number]) => 1 / Math.max(1, r.c.channels.length);
    const spent = rs.reduce((s, r) => s + r.c.spent * share(r), 0);
    const budget = rs.reduce((s, r) => s + r.c.budget * share(r), 0);
    const leads = rs.reduce((s, r) => s + r.s.leads * share(r), 0);
    const revenue = rs.reduce((s, r) => s + r.s.revenue * share(r), 0);
    return { ch, n: rs.length, budget, spent, leads, revenue, roi: spent ? (revenue - spent) / spent : 0 };
  }).filter((x) => x.n);
  const max = Math.max(1, ...byCh.map((x) => Math.max(x.spent, x.revenue)));
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px] [&>*]:min-w-0">
      <Panel title="Hiệu quả từng chiến dịch" action={<button className={cn(btnGhost, btnSm)} disabled={!rows.length} onClick={() => downloadBlob(`ChienDich_ROI_${isoDay(Date.now())}.xlsx`, xlsxBlob([{ name: 'Chien dich', widths: [14, 36, 24, 12, 12, 14, 14, 10, 8, 14, 10, 14], rows: [
        ['Mã', 'Chiến dịch', 'Kênh', 'Bắt đầu', 'Kết thúc', 'Ngân sách', 'Đã chi', 'Lead', 'Chốt', 'Doanh thu', 'ROI %', 'Trạng thái'],
        ...rows.map(({ c, s: x }) => [c.code, c.name, c.channels.map((ch) => MKT_CH[ch].label).join(', '), fmtDate(c.start), fmtDate(c.end), c.budget, c.spent, x.leads, x.won, Math.round(x.revenue), c.spent ? Math.round(x.roi * 100) : '', CAMP_STATUS[c.status].label]),
      ] }]))}><Download className="h-3.5 w-3.5" aria-hidden />Xuất Excel</button>}>
        <Table head={['Chiến dịch', 'Ngân sách', 'Đã chi', 'Lead', 'CPL', 'Chốt', 'Doanh thu', 'ROI', '']} minW={940}>
          {rows.map(({ c, s }) => (
            <tr key={c.id} className={cn(rowCls, 'cursor-pointer')} onClick={() => setEdit(c)}>
              <td className={tdFirst}><p className="max-w-[260px] truncate font-medium">{c.name}</p><p className="text-[11px] text-[rgb(var(--muted))]">{c.channels.map((ch) => MKT_CH[ch].label).join(', ')}</p></td>
              <td className={cn(tdCls, 'text-right tabular-nums')}>{compact(c.budget)}</td>
              <td className={cn(tdCls, 'text-right tabular-nums')}>{compact(c.spent)}{c.budget ? <span className="block text-[10px] text-[rgb(var(--muted))]">{Math.round((c.spent / c.budget) * 100)}%</span> : null}</td>
              <td className={cn(tdCls, 'text-right tabular-nums')}>{s.leads}{c.targetLeads ? <span className="text-[10px] text-[rgb(var(--muted))]"> / {c.targetLeads}</span> : null}</td>
              <td className={cn(tdCls, 'text-right tabular-nums')}>{s.leads ? compact(s.cpl) : '—'}</td>
              <td className={cn(tdCls, 'text-right tabular-nums')}>{s.won}</td>
              <td className={cn(tdCls, 'text-right tabular-nums')}>{compact(s.revenue)}</td>
              <td className={cn(tdCls, 'text-right font-semibold tabular-nums', c.spent ? (s.roi >= 0 ? 'text-[rgb(var(--success))]' : 'text-[rgb(var(--danger-fg))]') : '')}>{c.spent ? `${Math.round(s.roi * 100)}%` : '—'}</td>
            <td className={cn(tdLast, 'w-12')} onClick={(e) => e.stopPropagation()}><CampaignRowMenu c={c} onEdit={() => setEdit(c)} onConfirm={setConfirm} /></td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={9} className="py-8 text-center text-sm text-[rgb(var(--muted))]">Chưa có chiến dịch. Tạo ở tab Plan.</td></tr>}
        </Table>
        <p className="mt-3 text-[11px] text-[rgb(var(--muted))]">Lead gắn chiến dịch theo kênh nguồn và thời gian chạy (cộng 30 ngày theo dõi); doanh thu = lead đã chốt + đơn công trình ký từ lead đó + số liệu ngoài hệ thống nhập tay.</p>
      </Panel>
      <Panel title="Chi phí và doanh thu theo kênh">
        <ul className="space-y-3">
          {byCh.map((x) => (
            <li key={x.ch}>
              <div className="mb-1 flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full" style={{ background: MKT_CH[x.ch].color }} aria-hidden /><b className="font-medium">{MKT_CH[x.ch].label}</b><span className={cn('ml-auto font-num text-xs font-semibold', x.roi >= 0 ? 'text-[rgb(var(--success))]' : 'text-[rgb(var(--danger-fg))]')}>ROI {x.spent ? `${Math.round(x.roi * 100)}%` : '—'}</span></div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[11px]"><span className="w-16 text-[rgb(var(--muted))]">Chi</span><span className="h-2 rounded-full bg-[rgb(var(--accent))]" style={{ width: `${(x.spent / max) * 70}%` }} /><span className="font-num">{compact(x.spent)}</span></div>
                <div className="flex items-center gap-2 text-[11px]"><span className="w-16 text-[rgb(var(--muted))]">Doanh thu</span><span className="h-2 rounded-full bg-[rgb(var(--success))]" style={{ width: `${(x.revenue / max) * 70}%` }} /><span className="font-num">{compact(x.revenue)}</span></div>
              </div>
              <p className="mt-0.5 text-[11px] text-[rgb(var(--muted))]">{Math.round(x.leads)} lead · CPL {x.leads ? compact(x.spent / x.leads) : '—'} · ngân sách {compact(x.budget)}</p>
            </li>
          ))}
          {!byCh.length && <li className="text-sm text-[rgb(var(--muted))]">Chưa có dữ liệu</li>}
        </ul>
      </Panel>
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
      {edit && <CampaignSheet c={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

export function BannerStudio() {
  const { banners, setBanners, campaigns, company, canDo, notify } = useApp();
  const { write, ai } = useWriter();
  const [cur, setCur] = useState<BannerSpec>(() => banners[0] ?? { ...BANNER_PRESETS[0], id: uid('bn'), name: 'Banner mới', updatedAt: Date.now() });
  const cv = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const brand = company.shortName || company.appName;
  useEffect(() => { if (cv.current) void drawBanner(cv.current, cur, brand, company.logo); }, [cur, brand, company.logo]);
  const set = <K extends keyof BannerSpec>(k: K, v: BannerSpec[K]) => setCur((p) => ({ ...p, [k]: v }));
  const pickImg = async (k: 'bgImage' | 'productImage', f?: File) => { if (!f) return; set(k, await shrinkImage(f, 1600)); };
  const save = () => {
    const c = cv.current; let thumb: string | undefined;
    if (c) { const t = document.createElement('canvas'); t.width = 320; t.height = Math.round((320 * c.height) / c.width); t.getContext('2d')?.drawImage(c, 0, 0, t.width, t.height); thumb = t.toDataURL('image/jpeg', 0.7); }
    const v = { ...cur, thumb, updatedAt: Date.now() };
    setBanners((p) => (p.some((x) => x.id === v.id) ? p.map((x) => (x.id === v.id ? v : x)) : [v, ...p]));
    setCur(v); notify('Đã lưu banner', 'teal');
  };
  const exportPng = () => cv.current?.toBlob((b) => { if (b) downloadBlob(`${fold(cur.name).replace(/[^a-z0-9]+/g, '-') || 'banner'}.png`, b); }, 'image/png');
  const suggest = async () => {
    setBusy(true);
    const camp = campaigns.find((x) => x.id === cur.campaignId);
    if (ai.available) {
      const r = await ai.ask({ system: 'Bạn là copywriter quảng cáo. Trả về JSON {"headline":"≤ 8 từ","sub":"≤ 18 từ","cta":"≤ 4 từ"} bằng tiếng Việt.', prompt: `Thương hiệu ${brand}. ${camp ? `Chiến dịch ${camp.name}: ${camp.goal ?? ''}.` : ''} Tiêu đề hiện tại: ${cur.headline}. Đề xuất phương án mới hấp dẫn hơn.`, maxTokens: 300 });
      const j = r.ok ? parseAiJson<{ headline?: string; sub?: string; cta?: string }>(r.text) : null;
      if (j?.headline) { setCur((p) => ({ ...p, headline: j.headline ?? p.headline, sub: j.sub ?? p.sub, cta: j.cta ?? p.cta })); setBusy(false); return; }
    }
    const r = await write('ZALO_OA', 'Thuyết phục', camp?.goal ?? cur.headline, camp ? camp.name : '');
    const ls = r.text.split('\n').filter(Boolean);
    setCur((p) => ({ ...p, headline: ls[0]?.slice(0, 60) ?? p.headline, sub: ls[1]?.slice(0, 120) ?? p.sub, cta: ls.find((x) => x.startsWith('Nút:'))?.replace('Nút:', '').trim() ?? p.cta }));
    setBusy(false);
  };
  const ro = !canDo('mkt.manage');
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px] [&>*]:min-w-0">
      <section className="glass-card rounded-md p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input className={cn(inputBase, 'min-w-0 flex-1 font-semibold')} value={cur.name} onChange={(e) => set('name', e.target.value)} aria-label="Tên banner" disabled={ro} />
          <button className={btnGhost} onClick={exportPng}><Download className="h-4 w-4" aria-hidden />Tải PNG</button>
          {!ro && <button className={btnPrimary} onClick={save}>Lưu</button>}
        </div>
        <div className="flex items-center justify-center rounded-md bg-[rgb(var(--sunken))] p-3">
          <canvas ref={cv} className="h-auto max-h-[62vh] w-auto max-w-full rounded shadow-lg" aria-label="Xem trước banner" />
        </div>
        <p className="mt-2 text-xs text-[rgb(var(--muted))]">{BANNER_SIZE[cur.size].label} · xuất PNG đúng kích thước để đăng Facebook, Zalo OA, website.</p>
        {banners.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">Banner đã lưu</h3>
            <div className="flex gap-2 overflow-x-auto pb-1">{banners.map((b) => <button key={b.id} onClick={() => setCur(b)} className={cn('shrink-0 rounded-md border p-1', b.id === cur.id ? 'border-[rgb(var(--accent))]' : 'border-[rgb(var(--line))]')} title={b.name}>{b.thumb ? <img src={b.thumb} alt={b.name} className="h-16 w-auto rounded" /> : <span className="block h-16 w-24 rounded" style={{ background: b.bg }} />}</button>)}</div>
          </div>
        )}
      </section>
      <fieldset disabled={ro} className="glass-card space-y-3 rounded-md p-4">
        <div>
          <p className="mb-1.5 text-xs font-medium text-[rgb(var(--muted))]">Mẫu có sẵn</p>
          <div className="grid grid-cols-4 gap-1.5">{BANNER_PRESETS.map((p, i) => <button type="button" key={i} onClick={() => setCur((c) => ({ ...c, ...p, bgImage: c.bgImage, productImage: c.productImage }))} className="h-10 rounded border border-[rgb(var(--line))]" style={{ background: `linear-gradient(135deg, ${p.bg}, ${p.accent})` }} aria-label={`Mẫu ${i + 1}: ${p.headline}`} />)}</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Kích thước"><select className={inputCls} value={cur.size} onChange={(e) => set('size', e.target.value as BannerSize)}>{(Object.keys(BANNER_SIZE) as BannerSize[]).map((s) => <option key={s} value={s}>{BANNER_SIZE[s].label}</option>)}</select></Field>
          <Field label="Bố cục"><select className={inputCls} value={cur.layout} onChange={(e) => set('layout', e.target.value as BannerSpec['layout'])}><option value="LEFT">Chữ trái, ảnh phải</option><option value="CENTER">Căn giữa</option><option value="SPLIT">Chia đôi</option></select></Field>
        </div>
        <Field label="Tiêu đề"><textarea className={cn(inputCls, 'min-h-[52px]')} value={cur.headline} onChange={(e) => set('headline', e.target.value)} /></Field>
        <Field label="Mô tả"><textarea className={cn(inputCls, 'min-h-[52px]')} value={cur.sub} onChange={(e) => set('sub', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nút kêu gọi"><input className={inputCls} value={cur.cta} onChange={(e) => set('cta', e.target.value)} /></Field>
          <Field label="Chiến dịch"><select className={inputCls} value={cur.campaignId ?? ''} onChange={(e) => set('campaignId', e.target.value || undefined)}><option value="">—</option>{campaigns.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        </div>
        <button type="button" className={cn(btnGhost, 'w-full')} onClick={() => void suggest()} disabled={busy}><Sparkles className="h-4 w-4 text-[rgb(var(--accent))]" aria-hidden />{busy ? 'Đang gợi ý…' : 'AI gợi ý tiêu đề & lời kêu gọi'}</button>
        <div className="grid grid-cols-4 gap-2">
          {([['bg', 'Nền 1'], ['bg2', 'Nền 2'], ['accent', 'Nhấn'], ['ink', 'Chữ']] as const).map(([k, l]) => <label key={k} className="text-[11px] text-[rgb(var(--muted))]">{l}<input type="color" className="mt-1 h-9 w-full cursor-pointer rounded border border-[rgb(var(--line))]" value={cur[k]} onChange={(e) => set(k, e.target.value)} /></label>)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className={cn(btnGhost, 'cursor-pointer text-xs')}><ImagePlus className="h-3.5 w-3.5" aria-hidden />Ảnh nền<input type="file" accept="image/*" className="sr-only" onChange={(e) => void pickImg('bgImage', e.target.files?.[0])} /></label>
          <label className={cn(btnGhost, 'cursor-pointer text-xs')}><Package className="h-3.5 w-3.5" aria-hidden />Ảnh sản phẩm<input type="file" accept="image/*" className="sr-only" onChange={(e) => void pickImg('productImage', e.target.files?.[0])} /></label>
        </div>
        {(cur.bgImage || cur.productImage) && <div className="flex gap-2 text-xs">{cur.bgImage && <button type="button" className="text-[rgb(var(--danger-fg))] hover:underline" onClick={() => set('bgImage', undefined)}>Bỏ ảnh nền</button>}{cur.productImage && <button type="button" className="text-[rgb(var(--danger-fg))] hover:underline" onClick={() => set('productImage', undefined)}>Bỏ ảnh sản phẩm</button>}</div>}
        <label className="flex items-center justify-between gap-2 text-sm">Hiện logo / tên thương hiệu<Switch on={cur.showLogo} onChange={(v) => set('showLogo', v)} label="Hiện logo" /></label>
        <button type="button" className={cn(btnGhost, 'w-full text-xs')} onClick={() => setCur({ ...BANNER_PRESETS[0], id: uid('bn'), name: 'Banner mới', updatedAt: Date.now() })}><Plus className="h-3.5 w-3.5" aria-hidden />Banner mới</button>
      </fieldset>
    </div>
  );
}

export function AudienceBuilder() {
  const app = useApp();
  const { audiences, setAudiences, canDo, notify } = app;
  const [cur, setCur] = useState<Audience | null>(null);
  const ro = !canDo('mkt.manage');
  const members = cur ? audienceMembers(cur, app) : [];
  const fields = cur ? AUD_FIELDS[cur.base] : [];
  const setRule = (i: number, r: Partial<AudRule>) => setCur((c) => (c ? { ...c, rules: c.rules.map((x, k) => (k === i ? { ...x, ...r } : x)) } : c));
  const exportCsv = () => cur && downloadCsv(`phan-khuc-${fold(cur.name).replace(/[^a-z0-9]+/g, '-')}.csv`, [['Tên', 'Mã', 'Liên hệ', 'Điện thoại', 'Email', 'Địa chỉ / tỉnh'], ...members.map((r) => ('company' in r ? [r.company, r.code, r.contact, r.phone, r.email ?? '', r.province ?? ''] : [r.name, r.code, r.contactName, r.contactPhone, r.contactEmail, r.address]))]);
  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr] [&>*]:min-w-0">
      <section className="glass-card rounded-md p-3">
        <div className="mb-2 flex items-center justify-between px-1"><h3 className="text-sm font-semibold">Phân khúc ({audiences.length})</h3>{!ro && <button className={cn(btnGhost, btnSm)} onClick={() => setCur({ id: uid('au'), name: 'Phân khúc mới', base: 'CUSTOMER', match: 'ALL', rules: [{ field: 'growth', op: 'gte', value: '7' }], createdAt: Date.now() })}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm</button>}</div>
        <ul className="space-y-1">{audiences.map((a) => <li key={a.id}><button className={cn('w-full rounded-md px-3 py-2 text-left text-sm', cur?.id === a.id ? 'bg-[rgb(var(--secondary)/0.12)]' : 'hover:bg-[rgb(var(--ink)/0.04)]')} onClick={() => setCur(a)}><span className="block truncate font-medium">{a.name}</span><span className="text-[11px] text-[rgb(var(--muted))]">{a.base === 'CUSTOMER' ? 'Khách hàng' : 'Lead'} · {audienceMembers(a, app).length} đối tượng</span></button></li>)}
          {!audiences.length && <li className="px-3 py-6 text-center text-xs text-[rgb(var(--muted))]">Chưa có phân khúc</li>}</ul>
      </section>
      {cur ? (
        <section className="glass-card space-y-4 rounded-md p-5">
          <fieldset disabled={ro} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_160px_160px]">
              <Field label="Tên phân khúc"><input className={inputCls} value={cur.name} onChange={(e) => setCur({ ...cur, name: e.target.value })} /></Field>
              <Field label="Dữ liệu"><select className={inputCls} value={cur.base} onChange={(e) => setCur({ ...cur, base: e.target.value as AudBase, rules: [] })}><option value="CUSTOMER">Khách hàng</option><option value="LEAD">Lead / dự án</option></select></Field>
              <Field label="Điều kiện"><select className={inputCls} value={cur.match} onChange={(e) => setCur({ ...cur, match: e.target.value as 'ALL' | 'ANY' })}><option value="ALL">Thỏa tất cả</option><option value="ANY">Thỏa một trong</option></select></Field>
            </div>
            {cur.rules.map((r, i) => { const f = fields.find((x) => x.key === r.field) ?? fields[0]; return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select className={cn(inputBase, 'w-48')} value={r.field} onChange={(e) => { const nf = fields.find((x) => x.key === e.target.value)!; setRule(i, { field: nf.key, op: AUD_OPS[nf.type][0][0], value: nf.type === 'bool' ? 'true' : '' }); }} aria-label="Trường">{fields.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
                <select className={cn(inputBase, 'w-32')} value={r.op} onChange={(e) => setRule(i, { op: e.target.value as AudOp })} aria-label="Phép so sánh">{AUD_OPS[f.type].map(([o, l]) => <option key={o} value={o}>{l}</option>)}</select>
                {f.type === 'select' ? <select className={cn(inputBase, 'min-w-0 flex-1')} value={r.value} onChange={(e) => setRule(i, { value: e.target.value })} aria-label="Giá trị"><option value="">Chọn…</option>{(f.options?.(app) ?? []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  : f.type === 'bool' ? <select className={cn(inputBase, 'min-w-0 flex-1')} value={r.value} onChange={(e) => setRule(i, { value: e.target.value })} aria-label="Giá trị"><option value="true">Có</option><option value="false">Không</option></select>
                  : <input className={cn(inputBase, 'min-w-0 flex-1')} type={f.type === 'number' ? 'number' : 'text'} value={r.value} onChange={(e) => setRule(i, { value: e.target.value })} aria-label="Giá trị" />}
                <button type="button" className="rounded p-1.5 hover:bg-[rgb(var(--ink)/0.06)]" onClick={() => setCur({ ...cur, rules: cur.rules.filter((_, k) => k !== i) })} aria-label="Xóa điều kiện"><X className="h-4 w-4" /></button>
              </div>
            ); })}
            <button type="button" className={cn(btnGhost, btnSm)} onClick={() => setCur({ ...cur, rules: [...cur.rules, { field: fields[0].key, op: AUD_OPS[fields[0].type][0][0], value: '' }] })}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm điều kiện</button>
          </fieldset>
          <div className="flex flex-wrap items-center gap-2 border-t border-[rgb(var(--line))] pt-3">
            <p className="text-sm"><b className="font-num text-lg">{members.length}</b> đối tượng khớp</p>
            <button className={cn(btnGhost, btnSm, 'ml-auto')} onClick={exportCsv} disabled={!members.length}><Download className="h-3.5 w-3.5" aria-hidden />Xuất CSV</button>
            {!ro && <button className={cn(btnGhost, btnSm, 'text-[rgb(var(--danger-fg))]')} onClick={() => { setAudiences((p) => p.filter((x) => x.id !== cur.id)); setCur(null); }}>Xóa</button>}
            {!ro && <button className={btnPrimary} onClick={() => { setAudiences((p) => (p.some((x) => x.id === cur.id) ? p.map((x) => (x.id === cur.id ? cur : x)) : [cur, ...p])); notify('Đã lưu phân khúc', 'teal'); }}>Lưu phân khúc</button>}
          </div>
          <Table head={cur.base === 'CUSTOMER' ? ['Khách hàng', 'Hạng', 'Doanh số năm nay', 'Năm trước', 'Công nợ'] : ['Lead / dự án', 'Kênh', 'Trạng thái', 'Giá trị']} minW={640}>
            {members.slice(0, 15).map((r) => 'company' in r ? (
              <tr key={r.id} className={rowCls}><td className={tdFirst}><p className="font-medium">{r.company}</p><p className="font-mono text-[11px] text-[rgb(var(--muted))]">{r.code}</p></td><td className={tdCls}>{SOURCE_LABEL[r.source]}</td><td className={tdCls}><Chip tone={LEAD_STATUS[r.status].tone}>{LEAD_STATUS[r.status].label}</Chip></td><td className={cn(tdLast, 'text-right tabular-nums')}>{compact(boqTotal(r))}</td></tr>
            ) : (
              <tr key={r.id} className={rowCls}><td className={tdFirst}><p className="font-medium">{r.name}</p><p className="font-mono text-[11px] text-[rgb(var(--muted))]">{r.code}</p></td><td className={tdCls}>{r.tier}</td><td className={cn(tdCls, 'text-right tabular-nums')}>{compact(r.ytdRevenue)}</td><td className={cn(tdCls, 'text-right tabular-nums')}>{compact(r.lastYearRevenue)}</td><td className={cn(tdLast, 'text-right tabular-nums')}>{compact(r.debt)}</td></tr>
            ))}
            {!members.length && <tr><td colSpan={5} className="py-6 text-center text-sm text-[rgb(var(--muted))]">Không có đối tượng khớp</td></tr>}
          </Table>
          {members.length > 15 && <p className="text-xs text-[rgb(var(--muted))]">Hiển thị 15 / {members.length}. Xuất CSV để xem đủ.</p>}
        </section>
      ) : <section className="glass-card flex items-center justify-center rounded-md p-10"><EmptyState art="search" text="Chọn hoặc tạo phân khúc" hint="Lọc khách theo hạng, khu vực, doanh số, tăng trưởng, công nợ, kết nối Zalo… để gửi đúng người, đúng thông điệp." /></section>}
    </div>
  );
}

export function AutomationList() {
  const app = useApp();
  const { automations, setAutomations, autoRuns, audiences, canDo, notify, company } = app;
  const [edit, setEdit] = useState<Automation | null>(null);
  const [log, setLog] = useState(false);
  const ro = !canDo('mkt.manage');
  const mode = bizMode(company);
  const neu = (): Automation => ({ id: uid('wf'), name: 'Kịch bản mới', active: false, dryRun: true, trigger: mode === 'MFG' ? 'JOB_WON' : 'LEAD_NEW', days: 1, steps: [{ id: uid('st'), wait: 0, channel: 'ZNS', text: 'Cảm ơn {ten} đã quan tâm {congty}. Nhân viên sẽ liên hệ trong 15 phút.' }], createdAt: Date.now() });
  const runsOf = (id: string) => autoRuns.filter((r) => r.wfId === id);
  return (
    <section className="glass-card rounded-md p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-sm text-[rgb(var(--muted))]">Tự động gửi Zalo ZNS / Zalo OA / SMS / Messenger Fanpage theo hành vi và phân khúc, lấy dữ liệu trực tiếp từ CRM. Kịch bản mới mặc định <b>chạy thử</b> (không gửi thật). SMS và Messenger ghi nhận ở chế độ mô phỏng cho đến khi kết nối nhà cung cấp.</p>
        <button className={cn(btnGhost, 'ml-auto')} onClick={() => setLog(true)}><History className="h-4 w-4" aria-hidden />Nhật ký gửi</button>
        {!ro && <button className={btnAccent} onClick={() => setEdit(neu())}><Plus className="h-4 w-4" aria-hidden />Kịch bản mới</button>}
      </div>
      <Table head={['Kịch bản', 'Kích hoạt khi', 'Phân khúc', 'Các bước', 'Đã kích hoạt', 'Đã gửi / lỗi', 'Bật']} minW={980}>
        {automations.map((w) => { const rs = runsOf(w.id); const sent = rs.reduce((s, r) => s + r.log.filter((l) => l.ok).length, 0); const fail = rs.reduce((s, r) => s + r.log.filter((l) => !l.ok).length, 0); return (
          <tr key={w.id} className={cn(rowCls, 'cursor-pointer')} onClick={() => setEdit(w)}>
            <td className={tdFirst}><p className="font-medium">{w.name}</p>{w.dryRun && <Chip tone="orange">Chạy thử</Chip>}</td>
            <td className={tdCls}>{AUTO_TRIGGER[w.trigger].label}{AUTO_TRIGGER[w.trigger].days ? <span className="block text-[11px] text-[rgb(var(--muted))]">N = {w.days} ngày</span> : null}</td>
            <td className={tdCls}>{audiences.find((a) => a.id === w.audienceId)?.name ?? 'Tất cả'}</td>
            <td className={tdCls}><div className="flex flex-wrap items-center gap-1 text-[11px]">{w.steps.map((s, i) => <span key={s.id} className="rounded bg-[rgb(var(--ink)/0.06)] px-1.5 py-0.5">{i ? `+${s.wait}h ` : s.wait ? `${s.wait}h ` : ''}{AUTO_CH[s.channel]}</span>)}</div></td>
            <td className={cn(tdCls, 'text-right tabular-nums')}>{rs.length}</td>
            <td className={cn(tdCls, 'text-right tabular-nums')}>{sent}{fail ? <span className="text-[rgb(var(--danger-fg))]"> / {fail}</span> : ''}</td>
            <td className={tdLast} onClick={(e) => e.stopPropagation()}><Switch on={w.active} disabled={ro} label={`Bật ${w.name}`} onChange={(v) => { setAutomations((p) => p.map((x) => (x.id === w.id ? { ...x, active: v, activatedAt: v ? x.activatedAt ?? Date.now() : x.activatedAt } : x))); notify(v ? `Đã bật ${w.name}${w.dryRun ? ' (chạy thử)' : ''}` : `Đã tắt ${w.name}`, v ? 'teal' : 'orange'); }} /></td>
          </tr>
        ); })}
        {!automations.length && <tr><td colSpan={7} className="py-8 text-center text-sm text-[rgb(var(--muted))]">Chưa có kịch bản tự động</td></tr>}
      </Table>
      {edit && <AutomationSheet w={edit} onClose={() => setEdit(null)} />}
      {log && (
        <SideSheet title="Nhật ký gửi tự động" sub={`${autoRuns.length} lượt kích hoạt`} onClose={() => setLog(false)} width="sm:w-[640px]">
          <ul className="space-y-2">
            {autoRuns.flatMap((r) => r.log.map((l) => ({ r, l }))).sort((a, b) => b.l.at - a.l.at).slice(0, 100).map(({ r, l }, i) => (
              <li key={i} className="rounded-md border border-[rgb(var(--line))] px-3 py-2 text-xs">
                <p className="flex items-center gap-2"><b>{r.subject.name}</b><span className="text-[rgb(var(--muted))]">{automations.find((w) => w.id === r.wfId)?.name}</span><span className="ml-auto text-[rgb(var(--muted))]">{new Date(l.at).toLocaleString('vi-VN')}</span></p>
                <p className={l.ok ? 'text-[rgb(var(--muted))]' : 'text-[rgb(var(--danger-fg))]'}>Bước {l.step + 1} · {AUTO_CH[l.channel]} · {l.detail}</p>
              </li>
            ))}
            {!autoRuns.some((r) => r.log.length) && <li className="py-8 text-center text-sm text-[rgb(var(--muted))]">Chưa có lượt gửi</li>}
          </ul>
        </SideSheet>
      )}
    </section>
  );
}

export function AutomationSheet({ w, onClose }: { w: Automation; onClose: () => void }) {
  const app = useApp();
  const { automations, setAutomations, setAutoRuns, audiences, hubCfg, canDo, notify, company, now } = app;
  const [f, setF] = useState<Automation>(w);
  const ro = !canDo('mkt.manage');
  const mode = bizMode(company);
  const subjects = autoSubjects({ ...f, activatedAt: f.activatedAt ?? 0 }, app, now ?? Date.now());
  const setStep = (i: number, p: Partial<AutoStep>) => setF((x) => ({ ...x, steps: x.steps.map((s, k) => (k === i ? { ...s, ...p } : s)) }));
  const save = () => { setAutomations((p) => (p.some((x) => x.id === f.id) ? p.map((x) => (x.id === f.id ? f : x)) : [f, ...p])); notify('Đã lưu kịch bản', 'teal'); onClose(); };
  return (
    <SideSheet title={automations.some((x) => x.id === w.id) ? 'Sửa kịch bản tự động' : 'Kịch bản tự động mới'} onClose={onClose} width="sm:w-[600px]"
      footer={ro ? <button className={btnGhost} onClick={onClose}>Đóng</button> : <>
        {automations.some((x) => x.id === w.id) && <button className={cn(btnGhost, 'mr-auto text-[rgb(var(--danger-fg))]')} onClick={() => { setAutomations((p) => p.filter((x) => x.id !== f.id)); setAutoRuns((p) => p.map((r) => (r.wfId === f.id && r.status === 'ACTIVE' ? { ...r, status: 'STOPPED' } : r))); onClose(); }}>Xóa</button>}
        <button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} disabled={!f.name.trim() || !f.steps.length} onClick={save}>Lưu</button></>}>
      <fieldset disabled={ro} className="space-y-4">
        <Field label="Tên kịch bản"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <Field label="Kích hoạt khi"><select className={inputCls} value={f.trigger} onChange={(e) => setF({ ...f, trigger: e.target.value as AutoTrigger })}>{(Object.keys(AUTO_TRIGGER) as AutoTrigger[]).filter((k) => !AUTO_TRIGGER[k].mode || mode === 'BOTH' || AUTO_TRIGGER[k].mode === mode).map((k) => <option key={k} value={k}>{AUTO_TRIGGER[k].label}</option>)}</select></Field>
          {AUTO_TRIGGER[f.trigger].days && <Field label="N (ngày)" hint={AUTO_TRIGGER[f.trigger].days}><input type="number" min={0} className={inputCls} value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) || 0 })} /></Field>}
        </div>
        <Field label={f.trigger === 'AUDIENCE' ? 'Phân khúc (bắt buộc)' : 'Chỉ áp dụng cho phân khúc'}><select className={inputCls} value={f.audienceId ?? ''} onChange={(e) => setF({ ...f, audienceId: e.target.value || undefined })}><option value="">{f.trigger === 'AUDIENCE' ? 'Chọn phân khúc…' : 'Tất cả'}</option>{audiences.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <div>
          <p className="mb-2 text-xs font-medium text-[rgb(var(--muted))]">Các bước gửi (biến: {'{ten}'} tên khách, {'{congty}'} tên công ty)</p>
          <ol className="space-y-2">
            {f.steps.map((s, i) => (
              <li key={s.id} className="rounded-md border border-[rgb(var(--line))] p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <b className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent-fg))]">{i + 1}</b>
                  <span>Chờ</span><input type="number" min={0} className={cn(inputBase, 'h-8 w-20 py-0')} value={s.wait} onChange={(e) => setStep(i, { wait: Number(e.target.value) || 0 })} aria-label="Số giờ chờ" /><span>giờ{i === 0 ? ' sau khi kích hoạt' : ' sau bước trước'}, gửi qua</span>
                  <select className={cn(inputBase, 'h-8 py-0')} value={s.channel} onChange={(e) => setStep(i, { channel: e.target.value as AutoChannel })} aria-label="Kênh gửi">{(Object.keys(AUTO_CH) as AutoChannel[]).map((c) => <option key={c} value={c}>{AUTO_CH[c]}</option>)}</select>
                  <button type="button" className="ml-auto rounded p-1 hover:bg-[rgb(var(--ink)/0.06)]" onClick={() => setF({ ...f, steps: f.steps.filter((_, k) => k !== i) })} aria-label="Xóa bước"><X className="h-4 w-4" /></button>
                </div>
                {s.channel === 'ZNS' && <select className={cn(inputCls, 'mb-2')} value={s.znsId ?? ''} onChange={(e) => setStep(i, { znsId: e.target.value || undefined })} aria-label="Mẫu ZNS"><option value="">{hubCfg.zalo.znsTemplates.length ? 'Chọn mẫu ZNS…' : 'Chưa có mẫu ZNS (khai báo ở Cài đặt > AI & Zalo)'}</option>{hubCfg.zalo.znsTemplates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
                <textarea className={cn(inputCls, 'min-h-[56px] text-sm')} value={s.text} onChange={(e) => setStep(i, { text: e.target.value })} placeholder={s.channel === 'ZNS' ? 'Nội dung điền vào tham số tự do của mẫu ZNS' : 'Nội dung tin nhắn'} aria-label="Nội dung" />
              </li>
            ))}
          </ol>
          <button type="button" className={cn(btnGhost, btnSm, 'mt-2')} onClick={() => setF({ ...f, steps: [...f.steps, { id: uid('st'), wait: 24, channel: 'ZALO_OA', text: 'Dạ em chào {ten}, {congty} xin phép hỏi thăm mình đã nhận được thông tin chưa ạ?' }] })}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm bước</button>
        </div>
        <label className="flex items-start justify-between gap-3 rounded-md border border-[rgb(var(--line))] p-3 text-sm"><span><b>Chạy thử</b><span className="block text-xs text-[rgb(var(--muted))]">Ghi nhật ký đầy đủ nhưng không gửi tin thật. Tắt khi đã kiểm tra xong.</span></span><Switch on={f.dryRun} onChange={(v) => setF({ ...f, dryRun: v })} label="Chạy thử" /></label>
        <div className="rounded-md bg-[rgb(var(--secondary)/0.07)] px-3 py-2.5 text-xs">
          <p><b className="font-num">{subjects.length}</b> đối tượng đang thỏa điều kiện{f.trigger === 'ZALO_FOLLOW' ? ' (chỉ tính khách quan tâm sau khi bật)' : ''}. Mỗi đối tượng chỉ chạy kịch bản 1 lần.</p>
          {subjects.slice(0, 5).map((s) => <p key={s.kind + s.id} className="truncate text-[rgb(var(--muted))]">• {s.name}{s.phone ? ` · ${s.phone}` : ''}{s.zaloUserId ? ' · có Zalo' : ''}</p>)}
        </div>
      </fieldset>
    </SideSheet>
  );
}

