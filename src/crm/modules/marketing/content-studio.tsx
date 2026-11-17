'use client';

import { type ReactNode, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, Copy, Sparkles } from 'lucide-react';
import { Chip } from '../../components/ui';
import { aiErrText, bizMode, btnGhost, btnPrimary, btnSm, CONTENT_STATUS, createStudioStore, FieldRow, idsKey, input, inputCls, load, OutlinePanel, plainOf, platformOfContent, SectionPane, SeoSidebar, socialFields, ST_BRAND, ST_HOOKS, ST_P_FACEBOOK, ST_P_GMAPS, ST_P_WEBSITE, ST_P_ZALO, ST_PLATFORM_CACHE, ST_STEPS, ST_TO_MKT, stArr, StCtx, stripMd, stRules, stStr, titleLine, toHashtag, uid, useApp, wordCount } from '../../lib/core';
import type { ContentBlock, ContentStatus, FieldDef, MktContent, PlatformStrategy, SeoItem, SeoReport, SeoRule, StArticle, StCompany, StStepId, StStore, StudioActions, StudioApi, StudioState, StudioStore } from '../../lib/types';
import { cn } from '../../lib/utils';
import { apiPost, useAi, useServerStatus } from '../ai/ai-core';
import { compactImage, localBlockText, localOutline, placeholderImage } from './marketing-hub';

export function stCreate<T>() {
  return (init: (set: StStore<T>['setState'], get: () => T) => T): StStore<T> => {
    let state = undefined as unknown as T;
    const ls = new Set<() => void>();
    const setState: StStore<T>['setState'] = (p) => {
      const part = typeof p === 'function' ? (p as (s: T) => Partial<T>)(state) : p;
      if (!part || !Object.keys(part).length) return;
      state = { ...state, ...part };
      ls.forEach((l) => l());
    };
    state = init(setState, () => state);
    return { getState: () => state, setState, subscribe: (l) => { ls.add(l); return () => { ls.delete(l); }; } };
  };
}

export function stUseStore<T, U>(store: StStore<T>, sel: (s: T) => U): U {
  return useSyncExternalStore(store.subscribe, () => sel(store.getState()), () => sel(store.getState()));
}

export function stPlatforms(): PlatformStrategy[] {
  if (!ST_PLATFORM_CACHE.list) {
    const l = [ST_P_WEBSITE, ST_P_FACEBOOK, ST_P_ZALO, ST_P_GMAPS].sort((a, b) => a.order - b.order);
    if (new Set(l.map((p) => p.id)).size !== l.length) throw new Error('platform_id_duplicate');
    ST_PLATFORM_CACHE.list = l;
  }
  return ST_PLATFORM_CACHE.list;
}

export function getPlatform(id: string): PlatformStrategy { return stPlatforms().find((p) => p.id === id) ?? stPlatforms()[0]; }

/** Cắt ở ranh giới từ, không cắt giữa chữ */
export function stClip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6))}…`;
}

/** Hàm thuần: cùng đầu vào => cùng kết quả, dễ test, dễ memo hóa. pass = 100% trọng số, warn = 50%. */
export function scoreArticle(a: StArticle, p: PlatformStrategy, company: StCompany): SeoReport {
  const plain = plainOf(a);
  const input = { article: a, plain, words: wordCount(plain), headings: p.structure.headings ? a.sections.map((s) => s.title) : [], images: a.sections.filter((s) => s.image).length, company };
  const items: SeoItem[] = p.seoRules.map((r: SeoRule) => ({ id: r.id, label: r.label, weight: r.weight, ...safe(r, input) }));
  const total = items.reduce((s, i) => s + i.weight, 0) || 1;
  const got = items.reduce((s, i) => s + (i.status === 'pass' ? i.weight : i.status === 'warn' ? i.weight / 2 : 0), 0);
  return { score: Math.round((got / total) * 100), words: input.words, images: input.images, chars: plain.length, items };
}

export function safe(r: SeoRule, x: Parameters<SeoRule['check']>[0]) {
  try { return r.check(x); } catch { return { status: 'warn' as const, detail: 'Không kiểm tra được' }; }
}

export function hashtagsOf(a: StArticle, brand: string): string[] {
  const rule = stStr(a.settings.hashtagRule) || 'brand_topic';
  if (rule === 'none') return [];
  const fixed = stArr(a.settings.hashtags).map((h) => (h.startsWith('#') ? h : toHashtag(h)));
  const topic = a.sections.slice(0, 2).map((s) => toHashtag(s.title.split(/[:,–-]/)[0]));
  return [...new Set([...(rule === 'brand_topic' ? [toHashtag(brand)] : []), ...fixed, ...topic])].slice(0, 6);
}

export function renderSocial(a: StArticle, brand: string): string {
  const cta = [stStr(a.settings.ctaText), stStr(a.settings.ctaPhone) && `☎ ${stStr(a.settings.ctaPhone)}`, stStr(a.settings.ctaLink) && `👉 ${stStr(a.settings.ctaLink)}`].filter(Boolean).join('\n');
  const tags = hashtagsOf(a, brand).join(' ');
  return [a.sapo, ...a.sections.map((s) => `${titleLine(s.title)}\n${stripMd(s.body)}`), cta, tags].filter(Boolean).join('\n\n');
}

export function socialStrategy(cfg: { id: string; label: string; description: string; order: number; maxChars: number; extraFields?: readonly FieldDef[] }): PlatformStrategy {
  return {
    id: cfg.id, label: cfg.label, description: cfg.description, order: cfg.order,
    structure: { headings: false, maxSections: 5, sapoLabel: 'Câu mở (hook)', sapoMax: 150, totalMax: cfg.maxChars },
    fields: socialFields(cfg.extraFields),
    defaults: (c) => ({ hook: 'AIDA', tone: 'friendly', ctaText: 'Nhắn ngay để nhận báo giá', ctaPhone: c.hotline ?? c.phone, ctaLink: c.website ?? '', hashtagRule: 'brand_topic', hashtags: [] }),
    validate: (s) => [...(!stStr(s.ctaText).trim() ? ['Nhập lời kêu gọi (CTA)'] : []), ...(!stStr(s.ctaPhone).trim() && !stStr(s.ctaLink).trim() ? ['Nhập số điện thoại hoặc liên kết'] : [])],
    outlinePrompt: (a) => `Lập dàn ý bài đăng ${cfg.label} cho chủ đề "${a.title}" theo cấu trúc ${stStr(a.settings.hook)} (${ST_HOOKS.find((h) => h.value === a.settings.hook)?.hint ?? ''}). Không dùng H2/H3: trả JSON {"sapo":"câu hook ≤150 ký tự","sections":[{"level":2,"title":"ý chính ngắn"}]} với 3–5 ý theo đúng thứ tự cấu trúc.`,
    sectionPrompt: (a, id) => `Viết ý "${a.sections.find((x) => x.id === id)?.title}" cho bài ${cfg.label} "${a.title}": 1–3 câu, chữ thuần, không markdown, có thể dùng 1 emoji đầu câu, giọng ${stStr(a.settings.tone)}.`,
    render: (a, c) => ({ format: 'text', body: renderSocial(a, c.name) }),
    seoRules: [
      { id: 'hook-len', label: 'Câu hook ≤ 150 ký tự (hiện trước "Xem thêm")', weight: 10, check: ({ article }) => { const n = article.sapo.length; return n === 0 ? { status: 'fail', detail: 'Chưa có hook' } : n <= 150 ? { status: 'pass', detail: `${n} ký tự` } : { status: 'warn', detail: `${n} ký tự` }; } },
      stRules.filled('ctaText', 'Có lời kêu gọi hành động', 10),
      stRules.totalChars(cfg.maxChars, 8),
      stRules.textImageRatio(250, 6),
      { id: 'hashtag', label: 'Có 2–6 hashtag', weight: 4, check: ({ article, company }) => { const n = hashtagsOf(article, company.name).length; return n >= 2 ? { status: 'pass', detail: `${n} hashtag` } : { status: 'warn', detail: `${n} hashtag` }; } },
    ],
    image: { aspect: 'square', hint: 'Ảnh vuông 1:1, chữ to, ít chữ' },
  };
}

/** Mô tả mức bám ảnh gốc để hiển thị dưới thanh trượt */
export function strengthLabel(v: number): string {
  if (v <= 0.25) return 'Giữ nguyên sản phẩm và bố cục, chỉ chỉnh ánh sáng, nền';
  if (v <= 0.5) return 'Giữ sản phẩm, đổi bối cảnh và góc chụp';
  if (v <= 0.75) return 'Giữ ý tưởng chính, sáng tạo bố cục mới';
  return 'Chỉ lấy cảm hứng từ ảnh tham chiếu';
}

// ---- studio/image/canvas.ts ----

/** Thu nhỏ ảnh tải lên về cạnh dài `max`, xuất JPEG (giảm dung lượng gửi máy chủ) */
export function stShrinkImage(file: File, max = 1024): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error('Không đọc được ảnh'));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => rej(new Error('Ảnh không hợp lệ'));
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.85));
      };
      img.src = String(r.result);
    };
    r.readAsDataURL(file);
  });
}

/**
 * Đóng dấu watermark thương hiệu SAU khi AI tạo ảnh (không nhờ AI vẽ logo: AI hay vẽ sai chữ / logo).
 * Dải màu navy ở góc dưới phải + chữ trắng, cỡ chữ theo chiều rộng ảnh.
 */
export function applyWatermark(dataUrl: string, text: string = ST_BRAND.name, logoUrl?: string): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => rej(new Error('Không đóng dấu được ảnh'));
    img.onload = async () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0);
      const fs = Math.max(14, Math.round(img.width * 0.028));
      g.font = `700 ${fs}px Inter, system-ui, sans-serif`;
      const pad = Math.round(fs * 0.6);
      const logo = logoUrl ? await load(logoUrl).catch(() => null) : null;
      const lw = logo ? Math.round(fs * 1.4 * (logo.width / logo.height)) : 0;
      const w = g.measureText(text).width + pad * 2 + (logo ? lw + pad / 2 : 0);
      const h = fs + pad * 1.4;
      const x = img.width - w - pad, y = img.height - h - pad;
      g.globalAlpha = 0.85; g.fillStyle = ST_BRAND.navy; g.fillRect(x, y, w, h);
      g.globalAlpha = 1; g.fillStyle = ST_BRAND.orange; g.fillRect(x, y, Math.max(3, fs * 0.18), h);
      if (logo) g.drawImage(logo, x + pad, y + (h - fs * 1.4) / 2, lw, fs * 1.4);
      g.fillStyle = '#ffffff'; g.textBaseline = 'middle';
      g.fillText(text, x + pad + (logo ? lw + pad / 2 : 0), y + h / 2);
      res(c.toDataURL('image/jpeg', 0.9));
    };
    img.src = dataUrl;
  });
}

export function StudioProvider({ company, initial, children }: { company: StCompany; initial?: StArticle; children: ReactNode }) {
  const ref = useRef<StudioStore | null>(null);
  if (!ref.current) ref.current = createStudioStore(company, initial);
  return <StCtx.Provider value={ref.current}>{children}</StCtx.Provider>;
}

export function useStudio<T>(selector: (s: StudioState) => T): T {
  const store = useContext(StCtx);
  if (!store) throw new Error('useStudio phải nằm trong <StudioProvider>');
  return stUseStore(store, selector);
}

/**
 * Lấy actions mà KHÔNG đăng ký theo dõi state: hàm trong store có tham chiếu cố định,
 * nên component chỉ gọi action (VD nút "Thêm mục") không bao giờ render lại khi người dùng gõ.
 */
export function useStudioActions(): StudioActions {
  const store = useContext(StCtx);
  if (!store) throw new Error('useStudioActions phải nằm trong <StudioProvider>');
  return store.getState();
}

/** Truy cập store để ĐỌC tức thời trong sự kiện (VD nút "Gợi ý tự động" cần cả bài viết) mà không đăng ký render */
export function useStudioApi(): StudioStore {
  const store = useContext(StCtx);
  if (!store) throw new Error('useStudioApi phải nằm trong <StudioProvider>');
  return store;
}

/**
 * Bước 1 — Form cài đặt động. Không có if/else theo kênh: danh sách trường lấy từ strategy.fields.
 * Đổi "Kênh phân phối" => form tự đổi; giá trị trùng khóa được giữ lại (store.setPlatform).
 */
export function DynamicSettingsForm() {
  const platformId = useStudio((s) => s.article.platform);
  const title = useStudio((s) => s.article.title);
  const settings = useStudio((s) => s.article.settings);
  const { setPlatform, setTitle } = useStudioActions();
  const p = getPlatform(platformId);
  const visible = p.fields.filter((f) => !f.showIf || f.showIf(settings));
  const errors = p.validate(settings);

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Kênh phân phối</legend>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" role="radiogroup">
          {stPlatforms().map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={x.id === platformId} onClick={() => setPlatform(x.id)}
              className={`rounded-lg border p-3 text-left transition-colors ${x.id === platformId ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.08)]' : 'border-[rgb(var(--line))] hover:border-[rgb(var(--accent)/0.5)]'}`}>
              <span className="block text-sm font-semibold">{x.label}</span>
              <span className="mt-0.5 block text-xs text-[rgb(var(--muted))]">{x.description}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Tiêu đề / chủ đề</span>
        <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: 5 lưu ý khi chọn băng keo VHB cho mặt dựng kính" />
      </label>

      <section aria-label={`Cài đặt cho ${p.label}`}>
        <h3 className="mb-3 text-sm font-semibold">Cài đặt {p.label}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((f) => <FieldRow key={`${p.id}:${f.key}`} field={f} />)}
        </div>
      </section>

      {errors.length > 0 && <ul className="space-y-1 text-sm text-[rgb(var(--danger-fg))]" role="alert">{errors.map((e) => <li key={e}>• {e}</li>)}</ul>}
    </div>
  );
}

export function CounterInput({ id, value, max, onChange }: { id: string; value: string; max: number; onChange: (v: string) => void }) {
  const n = value.length;
  const tone = n === 0 ? 'text-[rgb(var(--faint))]' : n > max ? 'text-[rgb(var(--danger-fg))]' : n > max * 0.9 ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--success-fg))]';
  return (
    <div>
      <input id={id} className={input} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={`${id}-n`} />
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded bg-[rgb(var(--sunken))]"><div className={`h-full ${n > max ? 'bg-[rgb(var(--danger))]' : 'bg-[rgb(var(--success))]'}`} style={{ width: `${Math.min(100, (n / max) * 100)}%` }} /></div>
        <span id={`${id}-n`} className={`text-xs tabular-nums ${tone}`}>{n}/{max}</span>
      </div>
    </div>
  );
}

export function TagInput({ id, value, onChange, placeholder }: { id: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => { const t = draft.trim().replace(/,$/, ''); if (t && !value.includes(t)) onChange([...value, t]); setDraft(''); };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-2 py-1.5 focus-within:border-[rgb(var(--accent))]">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded bg-[rgb(var(--accent)/0.12)] px-2 py-0.5 text-xs">
          {t}<button type="button" aria-label={`Bỏ ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>×</button>
        </span>
      ))}
      <input id={id} className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none" value={draft} placeholder={value.length ? '' : placeholder}
        onChange={(e) => setDraft(e.target.value)} onBlur={add}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1)); }} />
    </div>
  );
}

/**
 * Bước 3 — Split-view: Dàn ý (trái, kéo thả) | Nội dung + tạo ảnh từng mục (giữa) | Điểm SEO (phải, ghim).
 * Cuộn cột giữa => mục đang đọc tự sáng ở cột trái (scroll-spy bằng IntersectionObserver).
 */
export function ComposeSplitView({ api }: { api: StudioApi }) {
  const ids = useStudio(idsKey);
  const platformId = useStudio((s) => s.article.platform);
  const sapo = useStudio((s) => s.article.sapo);
  const { setSapo, setActive } = useStudioActions();
  const api0 = useStudioApi();
  const p = getPlatform(platformId);
  const scroller = useRef<HTMLDivElement>(null);
  const list = ids ? ids.split(',') : [];

  useEffect(() => {
    const root = scroller.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      const id = (top?.target as HTMLElement | undefined)?.dataset.sectionId;
      if (id && Date.now() - api0.getState().navAt > 900) setActive(id);
    }, { root, rootMargin: '0px 0px -65% 0px' });
    root.querySelectorAll('[data-section-id]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids, setActive, api0]);

  return (
    <div className="grid h-[calc(100vh-11rem)] min-h-[560px] grid-cols-1 overflow-hidden rounded-xl border border-[rgb(var(--line))] lg:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_300px]">
      <div className="hidden min-h-0 border-r border-[rgb(var(--line))] bg-[rgb(var(--surface))] lg:block">
        <OutlinePanel headings={p.structure.headings} />
      </div>
      <div ref={scroller} className="min-h-0 space-y-4 overflow-y-auto bg-[rgb(var(--bg))] p-4 pb-[50vh]">
        <label className="block rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4">
          <span className="mb-1 flex items-baseline justify-between text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
            {p.structure.sapoLabel}{p.structure.sapoMax && <span className={`tabular-nums ${sapo.length > p.structure.sapoMax ? 'text-[rgb(var(--danger-fg))]' : ''}`}>{sapo.length}/{p.structure.sapoMax}</span>}
          </span>
          <textarea rows={2} value={sapo} onChange={(e) => setSapo(e.target.value)} className="w-full resize-y bg-transparent text-[15px] font-medium leading-relaxed outline-none" />
        </label>
        {list.map((id, i) => <SectionPane key={id} id={id} index={i} api={api} />)}
        {!list.length && <p className="rounded-xl border border-dashed border-[rgb(var(--line))] p-8 text-center text-sm text-[rgb(var(--muted))]">Chưa có dàn ý. Quay lại Bước 2 để AI lập dàn ý, hoặc bấm "+ Thêm mục".</p>}
      </div>
      <div className="hidden min-h-0 overflow-y-auto border-l border-[rgb(var(--line))] bg-[rgb(var(--bg))] p-3 xl:block">
        <SeoSidebar />
      </div>
    </div>
  );
}

export function contentToArticle(c: MktContent, company: StCompany): StArticle {
  const platform = platformOfContent(c);
  return {
    id: c.id, platform, title: c.title, sapo: c.sapo ?? '', updatedAt: c.updatedAt,
    settings: { ...getPlatform(platform).defaults(company), ...(c.settings ?? {}) },
    sections: (c.blocks ?? []).map((b) => ({
      id: b.id, level: b.level, title: b.heading, body: b.body,
      image: b.image ? { url: b.image.url, prompt: b.image.prompt, alt: b.image.alt ?? b.heading, referenceUrl: b.image.referenceUrl, strength: b.image.strength, brandPalette: b.image.brandPalette ?? false, watermarked: b.image.watermarked ?? false, model: b.image.model ?? b.image.by, createdAt: b.image.at } : undefined,
    })),
  };
}

export function articleToContent(a: StArticle, base: MktContent, by: string): MktContent {
  const map = ST_TO_MKT[a.platform] ?? ST_TO_MKT.website;
  const prev = new Map((base.blocks ?? []).map((b) => [b.id, b]));
  const blocks: ContentBlock[] = a.sections.map((s) => {
    const old = prev.get(s.id);
    const img = s.image ? { url: s.image.url, prompt: s.image.prompt, by: s.image.model ?? by, at: s.image.createdAt, alt: s.image.alt, referenceUrl: s.image.referenceUrl, strength: s.image.strength, brandPalette: s.image.brandPalette, watermarked: s.image.watermarked, model: s.image.model } : undefined;
    const changed = img && old?.image?.url !== img.url;
    return { id: s.id, level: s.level, heading: s.title, points: old?.points ?? '', body: s.body, imagePrompt: old?.imagePrompt, image: img, imageHistory: changed ? [img!, ...(old?.imageHistory ?? [])].slice(0, 6) : old?.imageHistory };
  });
  const body = [a.sapo, ...blocks.flatMap((b) => [`${b.level === 2 ? '##' : '###'} ${b.heading}`, b.body])].filter(Boolean).join('\n\n');
  return { ...base, title: a.title, type: base.type === 'PRESS' && a.platform === 'website' ? 'PRESS' : map.type, channel: map.channel, platform: a.platform, sapo: a.sapo, settings: a.settings, blocks, body: `# ${a.title}\n\n${body}`, updatedAt: Date.now() };
}

/** Cổng AI cho Studio: dùng cấu hình AI của doanh nghiệp; chưa kết nối thì dùng mẫu soạn sẵn / ảnh mẫu */
export function useStudioPort(): StudioApi {
  const { company, org, hubCfg } = useApp();
  const ai = useAi('writer');
  const [srv] = useServerStatus();
  const brand = company.shortName || company.appName;
  const imgOn = hubCfg.ai.enabled && hubCfg.ai.features.image !== false && srv.images;
  const ref = useRef({ ai, imgOn, brand, company, org });
  ref.current = { ai, imgOn, brand, company, org };
  return useMemo<StudioApi>(() => ({
    async text(req) {
      const { ai: A, company: co } = ref.current;
      if (A.available) {
        const r = await A.ask({ system: req.system, prompt: req.prompt, maxTokens: req.maxTokens ?? 1500 });
        if (r.ok) return r.text;
        throw new Error(r.error);
      }
      const a = req.article;
      if (req.kind === 'outline' && a) {
        const t = ST_TO_MKT[a.platform]?.type ?? 'AD_POST';
        return JSON.stringify({ sapo: '', sections: localOutline(a.title, t, '').map((b) => ({ level: b.level, title: b.heading })) });
      }
      if (req.kind === 'section' && a) {
        const s = a.sections.find((x) => x.id === req.sectionId);
        if (s) return localBlockText({ id: s.id, level: s.level, heading: s.title, points: '', body: '' }, a.title, co);
      }
      throw new Error('Chưa kết nối AI (Cài đặt › AI, Zalo OA & ZNS)');
    },
    async image(req) {
      const { imgOn: on, org: o, brand: b } = ref.current;
      if (!on) return { dataUrl: placeholderImage(req.prompt.split('\n')[0].replace(/^Ảnh minh họa cho "|"\..*$/g, '').slice(0, 60), b, req.aspect), model: 'Ảnh mẫu (chưa kết nối API tạo ảnh)' };
      const reference = req.reference ? { mediaType: 'image/jpeg', data: req.reference.split(',')[1] ?? '' } : undefined;
      const r = await apiPost<{ b64: string; mediaType: string; model: string }>('/api/ai/image', { tenant: o.id, prompt: req.prompt, aspect: req.aspect, reference, strength: req.strength, brandPalette: req.brandPalette });
      if (!r.ok) throw new Error(aiErrText(r.error));
      return { dataUrl: await compactImage(`data:${r.mediaType};base64,${r.b64}`), model: r.model };
    },
  }), []);
}

/**
 * Không gian soạn bài toàn khung (thay ngăn trượt cũ): Studio 4 bước + thanh trạng thái duyệt.
 * Tự lưu nháp 1,5 giây sau mỗi thay đổi; Gửi duyệt / Duyệt / Đã đăng theo quyền mkt.manage như trước.
 */
export function StudioWorkspace({ c, onClose }: { c: MktContent | null; onClose: () => void }) {
  const { company, me } = useApp();
  const stCompany = useMemo<StCompany>(() => ({ name: company.shortName || company.appName, address: company.address ?? '', phone: company.phone ?? '', website: company.website, sector: bizMode(company) === 'MFG' ? 'nội thất, cửa nhôm kính, lắp đặt công trình' : 'vật tư điện, phụ kiện cáp, băng keo và vật liệu 3M cho công trình' }), [company]);
  const base = useMemo<MktContent>(() => c ?? { id: uid('ct'), title: '', type: 'AD_POST', channel: 'WEBSITE', platform: 'website', body: '', status: 'DRAFT', ownerId: me?.id, updatedAt: Date.now() }, [c, me?.id]);
  const initial = useMemo(() => contentToArticle(base, stCompany), [base, stCompany]);
  return (
    <StudioProvider company={stCompany} initial={initial}>
      <StudioShell base={base} onClose={onClose} />
    </StudioProvider>
  );
}

export function StudioShell({ base, onClose }: { base: MktContent; onClose: () => void }) {
  const { setContents, contents, canDo, me, notify, campaigns } = useApp();
  const api = useStudioPort();
  const store = useStudioApi();
  const step = useStudio((s) => s.step);
  const title = useStudio((s) => s.article.title);
  const platformId = useStudio((s) => s.article.platform);
  const canUndo = useStudio((s) => s.history.length > 0);
  const canNext = useStudio((s) => (s.step === 1 ? s.article.title.trim().length >= 8 && getPlatform(s.article.platform).validate(s.article.settings).length === 0 : s.step === 2 ? s.article.sections.length > 0 : true));
  const { setStep, undo } = useStudioActions();
  const ro = !canDo('mkt.manage');
  const live = contents.find((x) => x.id === base.id);
  const status: ContentStatus = live?.status ?? base.status;
  const [campaignId, setCampaignId] = useState(base.campaignId ?? '');
  const [saved, setSaved] = useState<number | null>(live ? live.updatedAt : null);

  /** Ghi vào danh sách nội dung; đọc bản mới nhất trong bộ cập nhật để lần tự lưu không ghi đè trạng thái vừa đổi */
  const persist = (next?: ContentStatus) => {
    const st = store.getState();
    if (!st.article.title.trim()) return false;
    setContents((p) => {
      const cur = p.find((x) => x.id === base.id) ?? base;
      const v: MktContent = { ...articleToContent(st.article, cur, me?.name ?? ''), campaignId: campaignId || undefined, step: st.step, status: next ?? cur.status, ownerId: cur.ownerId ?? me?.id, approvedBy: next === 'APPROVED' ? me?.id : cur.approvedBy };
      return p.some((x) => x.id === v.id) ? p.map((x) => (x.id === v.id ? v : x)) : [v, ...p];
    });
    setSaved(Date.now());
    return true;
  };
  const persistRef = useRef(persist); persistRef.current = persist;
  // Tự lưu nháp: 1,5 giây sau thay đổi cuối
  useEffect(() => {
    if (ro) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    let last = store.getState().article;
    const off = store.subscribe(() => {
      const a = store.getState().article;
      if (a === last) return;
      last = a;
      if (t) clearTimeout(t);
      t = setTimeout(() => persistRef.current(), 1500);
    });
    return () => { off(); if (t) { clearTimeout(t); persistRef.current(); } };
  }, [store, ro]);

  const act = (s: ContentStatus, msg: string) => { if (persist(s)) { notify(msg, 'teal'); if (s !== 'DRAFT') onClose(); } };
  const out = step === 4 ? getPlatform(platformId).render(store.getState().article, store.getState().company) : null;
  const copyOut = async () => {
    if (!out) return;
    try { await navigator.clipboard.writeText(out.format === 'html' ? out.body : out.body); notify(out.format === 'html' ? 'Đã sao chép HTML' : 'Đã sao chép nội dung', 'teal'); } catch { notify('Trình duyệt chặn sao chép', 'orange'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className={cn(btnGhost, btnSm)} onClick={onClose}><ArrowLeft className="h-4 w-4" aria-hidden />Danh sách</button>
        <p className="min-w-0 flex-1 truncate font-display text-[15px] font-bold">{title || 'Nội dung mới'}</p>
        <Chip tone={CONTENT_STATUS[status].tone}>{CONTENT_STATUS[status].label}</Chip>
        <span className="text-xs text-[rgb(var(--muted))]">{ro ? 'Chế độ xem' : saved ? `Đã lưu ${new Date(saved).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : 'Chưa lưu'}</span>
        {!ro && <button className={cn(btnGhost, btnSm)} disabled={!canUndo} onClick={undo} title="Hoàn tác thao tác cấu trúc gần nhất">Hoàn tác</button>}
      </div>

      <ol className="flex flex-wrap items-center gap-2" aria-label="Các bước">
        {ST_STEPS.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2">
            <button type="button" onClick={() => (s.id < step || canNext || s.id === step) && s.id <= step + (canNext ? 1 : 0) && setStep(s.id)} aria-current={s.id === step ? 'step' : undefined}
              className={cn('flex items-center gap-2 rounded-full px-3 py-1.5 text-sm', s.id === step ? 'bg-[rgb(var(--accent))] font-semibold text-[rgb(var(--on-accent))]' : s.id < step ? 'bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--muted))]')}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-xs">{s.id < step ? '✓' : s.id}</span>{s.label}
            </button>
            {i < ST_STEPS.length - 1 && <span className="h-px w-6 bg-[rgb(var(--line))]" aria-hidden />}
          </li>
        ))}
        <li className="ml-auto flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
          <label htmlFor="st-camp">Chiến dịch</label>
          <select id="st-camp" disabled={ro} className={cn(inputCls, 'h-8 w-auto py-0 text-xs')} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">Không gắn</option>{campaigns.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </li>
      </ol>

      <fieldset disabled={ro} className="min-w-0">
        {step === 1 && <div className="max-w-4xl rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-5"><DynamicSettingsForm /></div>}
        {step === 2 && <StudioOutlineStep api={api} />}
        {step === 3 && <ComposeSplitView api={api} />}
      </fieldset>
      {step === 4 && out && (
        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <article className="min-w-0 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 text-xs text-[rgb(var(--muted))]">{out.meta?.title ? <>Meta: <b>{out.meta.title}</b> · {out.meta.description}</> : `Bản xuất bản cho ${getPlatform(platformId).label}`}</p>
              <button className={cn(btnGhost, btnSm)} onClick={() => void copyOut()}><Copy className="h-3.5 w-3.5" aria-hidden />{out.format === 'html' ? 'Sao chép HTML' : 'Sao chép bài'}</button>
            </div>
            {out.format === 'html'
              ? <div className="max-w-3xl break-words text-[15px] leading-relaxed [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_img]:my-3 [&_img]:rounded-md [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: out.body }} />
              : <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-relaxed">{out.body}</pre>}
          </article>
          <SeoSidebar />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button className={btnGhost} disabled={step === 1} onClick={() => setStep((step - 1) as StStepId)}>Quay lại</button>
        <div className="flex flex-wrap gap-2">
          {!ro && <button className={btnGhost} disabled={!title.trim()} onClick={() => { if (persist()) notify('Đã lưu nháp', 'teal'); }}>Lưu nháp</button>}
          {step < 4
            ? <button className={btnPrimary} disabled={!canNext} onClick={() => setStep((step + 1) as StStepId)}>Tiếp tục</button>
            : !ro && (
              <>
                {status === 'DRAFT' && <button className={btnPrimary} onClick={() => act('REVIEW', 'Đã gửi duyệt')}>Gửi duyệt</button>}
                {status === 'REVIEW' && <button className={btnPrimary} onClick={() => act('APPROVED', 'Đã duyệt nội dung')}>Duyệt</button>}
                {status === 'APPROVED' && <button className={btnPrimary} onClick={() => act('PUBLISHED', 'Đã đánh dấu đã đăng')}>Đánh dấu đã đăng</button>}
              </>
            )}
        </div>
      </div>
    </div>
  );
}

/** Bước 2: AI lập dàn ý theo prompt của kênh; người dùng kéo thả, đổi cấp, thêm bớt ngay trong khung dàn ý */
export function StudioOutlineStep({ api }: { api: StudioApi }) {
  const platformId = useStudio((s) => s.article.platform);
  const count = useStudio((s) => s.article.sections.length);
  const store = useStudioApi();
  const { setOutline, setSapo } = useStudioActions();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const p = getPlatform(platformId);
  const gen = async () => {
    const st = store.getState();
    setBusy(true); setErr('');
    try {
      const raw = await api.text({ system: 'Chỉ trả JSON hợp lệ, không giải thích.', prompt: getPlatform(st.article.platform).outlinePrompt(st.article, st.company), kind: 'outline', article: st.article });
      const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as { sapo?: string; sections?: { level?: number; title?: string }[] };
      if (j.sapo) setSapo(j.sapo);
      setOutline((j.sections ?? []).filter((s) => s.title).map((s) => ({ level: s.level === 3 ? 3 : 2, title: String(s.title) })));
    } catch (e) { setErr(e instanceof SyntaxError ? 'AI trả dàn ý không đúng định dạng, thử lại' : e instanceof Error ? e.message : 'Không lập được dàn ý'); } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <div className="h-[480px] rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))]"><OutlinePanel headings={p.structure.headings} /></div>
      <div className="space-y-3 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-5 text-sm">
        <p>AI lập dàn ý theo cài đặt kênh <b>{p.label}</b>{p.structure.headings ? '' : ' (bài mạng xã hội: các ý không có H2/H3 khi xuất bản)'}. Kéo thả để đổi thứ tự{p.structure.headings ? ', bấm H2/H3 để đổi cấp' : ''}.</p>
        <button type="button" onClick={() => void gen()} disabled={busy} className={btnPrimary}><Sparkles className="h-4 w-4" aria-hidden />{busy ? 'Đang lập dàn ý…' : count ? 'Lập lại dàn ý' : 'AI lập dàn ý'}</button>
        {count > 0 && <p className="text-xs text-[rgb(var(--muted))]">Lập lại sẽ thay dàn ý hiện tại (có thể Hoàn tác).</p>}
        {err && <p className="text-[rgb(var(--danger-fg))]" role="alert">{err}</p>}
      </div>
    </div>
  );
}

