'use client';

// Bảng trượt "Nhiệm vụ nội dung" (Auto Content › Plan) v56.2: quy trình 3 bước theo bố cục 3A Studio cấp phát
// (trang content-step-1 / 2 / 3, đối tượng `content_task`). Ô của từng bước vẽ bằng DynamicFieldRenderer (cùng bộ vẽ với
// màn xem trước của 3A); trường gốc (chủ đề, kênh, mẫu nhanh, thông số kênh…) do màn hình này vẽ qua `builtin`,
// trường tùy chỉnh 3A định nghĩa lưu vào `cf` của nhiệm vụ (mktTasks: mỗi nhiệm vụ 1 dòng theo id — KEYED_COLLS).
import { type ReactNode, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ExternalLink, ImagePlus, Loader2, Sparkles, Trash2, X } from 'lucide-react';
import { FilePicker, SideSheet } from '../../components/ui';
import { cloudMessage } from '../../lib/cloud';
import { compressImage } from '../../lib/workshop';
import { btnAccent, btnGhost, btnPrimary, btnSm, cfMissing, cfSet, CloudError, CONTENT_STATUS, inputCls, MKT_CH, openContentReview, ST_BRIEF_FIELDS, ST_OF_CHANNEL, stArr, stCompanyOf, stStr, TASK_STATUS, uid, useApp, vKey, WRITER } from '../../lib/core';
import type { CfDef, CfVal, MktChannel, MktContentType, MktTask, RefImage, SkuItem, StSettings, WriterPreset } from '../../lib/types';
import { cn } from '../../lib/utils';
import { parseAiJson, useAi, useServerStatus } from '../ai/ai-core';
import { AttachImg, cfText, DynamicFieldRenderer, uploadCfImage, useContentTaskSteps, useNameOf } from '../page-builder';
import { getPlatform, StFieldControl } from './content-studio';
import { AiSpark, FormCard, KwConflictNote, openMktContent, QuickTemplates, Segmented, SelectMenu, useAiFillSettings, VariantGroupsGrid } from './content-workspace';
import { taskStatusOf, useAssignToAi } from './marketing-hub';

/** Thông số kênh mặc định kế thừa từ cấu hình thương hiệu (Cài đặt › Thông tin doanh nghiệp) — gom vào thẻ thu gọn ở Bước 2 */
export const CT_BRAND_KEYS = ['ctaPhone', 'ctaLink', 'hashtagRule', 'hashtags', 'nap'];
/** Trường gốc tự vẽ tiêu đề (thẻ "Yêu cầu soạn bài", "Thông số kênh", thẻ thu gọn thông số thương hiệu, "Yêu cầu hình ảnh") */
const CT_BARE = ['tpl', 'brief', 'seo', 'brand', 'imgReq', 'imgAdv'];
/** v56.3 Số ảnh tham chiếu tối đa (ảnh tải lên + ảnh sản phẩm) */
const REF_MAX = 2;
/** Kiểu trường không có nội dung chữ để gửi kèm (ảnh, chữ ký) */
const CT_NO_TEXT: CfDef['type'][] = ['media_gallery', 'signature'];

/**
 * v56.2 Ngữ cảnh riêng của nhiệm vụ gửi kèm khi soạn bài / tạo ảnh:
 * sản phẩm trọng tâm (tên, mã, thương hiệu, thông số do 3A định nghĩa cho sản phẩm) + trường tùy chỉnh của nhiệm vụ (nhãn đã áp bố cục: giá trị).
 */
export function contentTaskCtx(t: MktTask, o: { skus: SkuItem[]; defs: CfDef[]; labelOf: (key: string) => string; prodCf: CfDef[]; nameOf: (id: string) => string }): { text: string; image: string } {
  const sku = t.productSku ? o.skus.find((x) => x.sku === t.productSku) : undefined;
  const lines: string[] = [];
  let img = '';
  if (sku) {
    const spec = o.prodCf.filter((d) => d.status === 'ACTIVE' && !CT_NO_TEXT.includes(d.type)).map((d) => { const v = cfText(d, sku.cf?.[d.key], o.nameOf); return v ? `${d.label}: ${v}` : ''; }).filter(Boolean);
    const base = [sku.brand && `thương hiệu ${sku.brand}`, sku.unit && `đơn vị ${sku.unit}`, sku.origin && `xuất xứ ${sku.origin}`].filter(Boolean).join(', ');
    lines.push(`Sản phẩm / dịch vụ trọng tâm: ${sku.name} (mã ${sku.sku}${base ? `, ${base}` : ''})`);
    if (spec.length) lines.push(`Thông số sản phẩm: ${spec.join('; ')}`);
    img = `Sản phẩm chính trong ảnh: ${sku.name}${sku.brand ? ` (${sku.brand})` : ''}${spec.length ? `; ${spec.slice(0, 6).join('; ')}` : ''}`;
  }
  const cf = o.defs.filter((d) => d.scope === 'HEAD' && d.status === 'ACTIVE' && !CT_NO_TEXT.includes(d.type)).map((d) => {
    const v = cfText(d, t.cf?.[d.key], o.nameOf).trim();
    return v ? `${o.labelOf(`cf:${d.key}`)}: ${v}` : '';
  }).filter(Boolean);
  if (cf.length) lines.push(`Thông tin bổ sung của nhiệm vụ:\n${cf.map((x) => `- ${x}`).join('\n')}`);
  const image = [img, cf.length ? `Chi tiết cần thể hiện: ${cf.slice(0, 8).join('; ')}` : ''].filter(Boolean).join('. ');
  return { text: lines.join('\n'), image: image.length > 900 ? `${image.slice(0, 899)}…` : image };
}

/** Thanh 3 bước (dính trên cùng khi cuộn): bấm để chuyển bước; chấm đỏ = bước còn thiếu thông tin bắt buộc */
function StepBar({ titles, step, onStep, miss }: { titles: string[]; step: number; onStep: (i: number) => void; miss: boolean[] }) {
  return (
    <nav aria-label="Các bước" className="sticky -top-4 z-20 -mx-5 -mt-4 mb-4 border-b border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-5 py-3">
      <ol className="flex items-center gap-2">
        {titles.map((t, i) => {
          const on = i === step;
          const done = i < step && !miss[i];
          return (
            <li key={i} className="flex min-w-0 flex-1 items-center gap-2">
              <button type="button" aria-current={on ? 'step' : undefined} onClick={() => onStep(i)} className="flex min-w-0 items-center gap-2 rounded-md py-0.5 text-left">
                <span className={cn('relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-medium tabular-nums', on ? 'bg-[rgb(var(--fg))] text-[rgb(var(--surface))]' : done ? 'bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--fg))]' : 'border border-[rgb(var(--line))] text-[rgb(var(--muted))]')}>
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                  {miss[i] && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[rgb(var(--danger))]" aria-label="còn thiếu thông tin" />}
                </span>
                <span className="min-w-0"><span className="block text-[11px] text-[rgb(var(--muted))]">Bước {i + 1}</span><span className={cn('block truncate text-[13px]', on ? 'font-medium text-[rgb(var(--fg))]' : 'text-[rgb(var(--fg2))]')}>{t}</span></span>
              </button>
              {i < titles.length - 1 && <span className="h-px min-w-3 flex-1 bg-[rgb(var(--line))]" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Thông số kênh mặc định (SĐT, liên kết, hashtag cố định, NAP): thẻ thu gọn, giá trị kế thừa từ thương hiệu, tự mở khi còn thiếu */
function BrandAccordion({ label, pid, sv, onChange, missing, ro }: { label: string; pid: string; sv: StSettings; onChange: (next: StSettings) => void; missing: boolean; ro: boolean }) {
  const { company } = useApp();
  const co = useMemo(() => stCompanyOf(company), [company]);
  const plat = getPlatform(pid);
  const fields = plat.fields.filter((x) => CT_BRAND_KEYS.includes(x.key));
  const [open, setOpen] = useState(missing);
  if (!fields.length) return null;
  const isOpen = open || missing;
  const tags = stArr(sv.hashtags);
  const sum = [stStr(sv.ctaPhone), stStr(sv.ctaLink).replace(/^https?:\/\//, ''), tags.length ? `${tags.length} hashtag` : ''].filter(Boolean).join(' · ');
  const def = plat.defaults(co);
  const reset = () => onChange({ ...sv, ...Object.fromEntries(fields.map((x) => [x.key, def[x.key]]).filter(([, v]) => v !== undefined)) });
  return (
    <div className="rounded-lg border border-[rgb(var(--line))]" data-brand-defaults>
      <button type="button" aria-expanded={isOpen} onClick={() => setOpen(!isOpen)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-[rgb(var(--muted))] transition-transform', !isOpen && '-rotate-90')} aria-hidden />
        <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium">{label}</span><span className="block truncate text-[12px] text-[rgb(var(--muted))]">Kế thừa từ thương hiệu{sum ? ` · ${sum}` : ''}</span></span>
        {missing && <span className="shrink-0 text-[12px] text-[rgb(var(--danger-fg))]">Còn thiếu</span>}
      </button>
      {isOpen && (
        <div className="border-t border-[rgb(var(--line))] px-3 pb-3 pt-3">
          <div className="grid grid-cols-2 gap-3">
            {fields.filter((x) => !x.showIf || x.showIf(sv)).map((x) => <StFieldControl key={x.key} f={x} value={sv[x.key]} company={co} onChange={(v) => onChange({ ...sv, [x.key]: v })} />)}
          </div>
          {!ro && <button type="button" className="mt-2 text-[12px] font-medium text-[rgb(var(--secondary-fg))] hover:underline" onClick={reset}>Lấy lại theo thương hiệu</button>}
        </div>
      )}
    </div>
  );
}

/** Thông số kênh (từ khóa, SEO, CTA…) trừ nhóm kế thừa thương hiệu; nút điền ô trống ở góc phải */
function SeoCard({ label, pid, title, note, sv, onChange, ro, self }: { label: string; pid: string; title: string; note: string; sv: StSettings; onChange: (next: StSettings) => void; ro: boolean; self: { taskId?: string; contentId?: string } }) {
  const { company } = useApp();
  const co = useMemo(() => stCompanyOf(company), [company]);
  const plat = getPlatform(pid);
  const fill = useAiFillSettings();
  const fields = plat.fields.filter((x) => !CT_BRAND_KEYS.includes(x.key) && (!x.showIf || x.showIf(sv)));
  const aiKey = fields.find((x) => x.key === 'focusKeyword' || x.key === 'localKeyword' || x.key === 'ctaText')?.key;
  const runFill = () => void fill.run(title, pid, note, sv, onChange);
  if (!fields.length) return null;
  return (
    <FormCard title={label === 'Thông số kênh (từ khóa, SEO)' ? `Thông số ${plat.label}` : label} aside={!ro && fill.available ? <AiSpark title="Điền các ô còn trống theo chủ đề" busy={fill.busy} disabled={!title.trim()} onClick={runFill} /> : null}>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((x) => (
          <StFieldControl key={x.key} f={x} value={sv[x.key]} company={co} onChange={(v) => onChange({ ...sv, [x.key]: v })}
            onSuggest={x.suggest ? () => onChange({ ...sv, [x.key]: x.suggest!({ id: 'x', platform: pid, title, sapo: '', sections: [], settings: sv, updatedAt: Date.now() }, sv) }) : undefined}
            onAi={!ro && fill.available && x.key === aiKey ? runFill : undefined} aiBusy={fill.busy} />
        ))}
      </div>
      {stStr(sv.focusKeyword).trim() && <div className="mt-3"><KwConflictNote kw={stStr(sv.focusKeyword)} self={self} /></div>}
    </FormCard>
  );
}

export function TaskSheet({ t, onClose }: { t: MktTask; onClose: () => void }) {
  const { mktTasks, setMktTasks, campaigns, contents, users, canDo, notify, go, company, skus, org } = useApp();
  const [upBusy, setUpBusy] = useState(false);
  const assign = useAssignToAi();
  const lay = useContentTaskSteps();
  const nameOf = useNameOf();
  const ai = useAi('writer');
  const [srv] = useServerStatus();
  const stCo = useMemo(() => stCompanyOf(company), [company]);
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [titleSugs, setTitleSugs] = useState<string[] | null>(null);
  const [titleBusy, setTitleBusy] = useState(false);
  const [f, setF] = useState<MktTask>(() => {
    const pid = t.platform ?? ST_OF_CHANNEL[t.channel];
    return pid ? { ...t, platform: pid, settings: { ...getPlatform(pid).defaults(stCompanyOf(company)), ...(t.settings ?? {}) } } : t;
  });
  const set = <K extends keyof MktTask>(k: K, v: MktTask[K]) => setF((p) => ({ ...p, [k]: v }));
  const pid = f.platform && ST_OF_CHANNEL[f.channel] ? f.platform : undefined;
  const plat = pid ? getPlatform(pid) : null;
  const sv = f.settings ?? {};
  const setSv = (next: StSettings) => setF((p) => ({ ...p, settings: next }));
  const setChannel = (ch: MktChannel) => setF((p) => {
    const np = ST_OF_CHANNEL[ch];
    if (!np) return { ...p, channel: ch, platform: undefined };
    const keep = Object.fromEntries(Object.entries(p.settings ?? {}).filter(([k]) => k.startsWith('v_') || k === 'imgMode' || getPlatform(np).fields.some((x) => x.key === k) || ST_BRIEF_FIELDS.some((x) => x.key === k)));
    return { ...p, channel: ch, platform: np, settings: { ...getPlatform(np).defaults(stCo), ...keep } };
  });
  const ro = !canDo('mkt.manage');
  const exists = mktTasks.some((x) => x.id === f.id);
  const live = mktTasks.find((x) => x.id === f.id) ?? f;
  const st = taskStatusOf(live, contents);
  const content = contents.find((c) => c.id === live.contentId);
  const prod = f.productSku ? skus.find((x) => x.sku === f.productSku) : undefined;
  const busy = st === 'AI_QUEUED' || st === 'PUBLISHED';

  // ---- kiểm tra trước khi giao: chủ đề, thông số bắt buộc của kênh, trường tùy chỉnh "Trước khi giao AI" (theo bố cục 3A) ----
  // lỗi của kênh là câu "Nhập …": bỏ chữ "Nhập" để ghép chung; lỗi về SĐT / liên kết / hashtag nằm ở thẻ thông số thương hiệu
  const errs = (plat ? plat.validate(sv) : []).map((e) => e.replace(/^Nhập\s+/, ''));
  const isBrand = (e: string) => /số điện thoại|liên kết|hashtag|NAP/i.test(e);
  const brandMiss = errs.some(isBrand);
  const missing = [
    ...(!f.title.trim() ? [{ label: lay.labelOf('title'), step: Math.max(0, lay.stepOf('title')) }] : []),
    ...errs.map((e) => ({ label: e, step: Math.max(0, lay.stepOf(isBrand(e) ? 'brand' : 'seo')) })),
    ...cfMissing(lay.formDefs, f.cf, 'SAVE').map((d) => ({ label: lay.labelOf(`cf:${d.key}`), step: Math.max(0, lay.stepOf(`cf:${d.key}`)) })),
  ].sort((a, b) => a.step - b.step);
  const stepMiss = [0, 1, 2].map((i) => missing.some((m) => m.step === i));
  const curMiss = missing.filter((m) => m.step === step);

  const save = (x = f) => setMktTasks((p) => (p.some((y) => y.id === x.id) ? p.map((y) => (y.id === x.id ? { ...x, contentId: y.contentId ?? x.contentId } : y)) : [x, ...p]));
  const saveDraft = () => {
    if (!f.title.trim()) { setStep(Math.max(0, lay.stepOf('title'))); notify(`Nhập ${lay.labelOf('title').toLowerCase()} trước khi lưu nháp`, 'orange'); return; }
    save(); notify('Đã lưu nháp nhiệm vụ', 'teal'); onClose();
  };
  const give = () => {
    setTried(true);
    if (missing.length) { setStep(missing[0].step); notify(`Cần nhập trước khi giao: ${missing.map((m) => m.label).join(', ')}`, 'orange'); return; }
    save(); assign(f); onClose();
  };
  const openStudio = () => { if (!live.contentId) return; onClose(); openMktContent(live.contentId, go); };

  // Sản phẩm trọng tâm: ảnh sản phẩm tự thành ảnh tham chiếu (Bước 3), tên sản phẩm vào "Sản phẩm cần nhắc tới" (Bước 2)
  const pickProduct = (code: string | undefined) => setF((p) => {
    const s0 = p.settings ?? {};
    const prev = p.productSku;
    const x = code ? skus.find((k) => k.sku === code) : undefined;
    const refs = stArr(s0[vKey('imgRef')]).filter((r) => r !== prev);
    const names = stArr(s0.products).filter((n) => n !== (prev ? skus.find((k) => k.sku === prev)?.name : undefined));
    const next: StSettings = { ...s0, [vKey('imgRef')]: x?.image ? [x.sku, ...refs.filter((r) => r !== x.sku)].slice(0, 2) : refs };
    if (p.platform) next.products = x && !names.includes(x.name) ? [x.name, ...names] : names;
    return { ...p, productSku: code, settings: next };
  });
  // v56.3 Ảnh tham chiếu tải tự do: thuộc riêng nhiệm vụ (kho riêng tư crm-attach), không ghi vào danh mục sản phẩm
  const uploadRef = async (file?: File) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) { notify('Chọn tệp ảnh (JPG, PNG, WebP)', 'red'); return; }
    setUpBusy(true);
    try {
      const blob = await (await fetch(await compressImage(file, 1600))).blob();
      const up = await uploadCfImage(org.id, `marketing/tasks/${f.id}`, blob, '');
      const r: RefImage = { id: uid('ri'), url: up.url, path: up.path, name: file.name, size: up.size };
      setF((p) => {
        const sku = stArr(p.settings?.[vKey('imgRef')]);
        const imgs = [...(p.refImages ?? []), r];
        // tổng tối đa 2 ảnh: ảnh tải lên được ưu tiên, bớt ảnh sản phẩm khi vượt
        const keep = sku.slice(0, Math.max(0, REF_MAX - imgs.length));
        return { ...p, refImages: imgs.slice(-REF_MAX), settings: { ...(p.settings ?? {}), [vKey('imgRef')]: keep } };
      });
      notify('Đã thêm ảnh tham chiếu', 'teal');
    } catch (e) {
      notify(e instanceof CloudError ? cloudMessage(e) : e instanceof Error ? e.message : 'Không tải được ảnh', 'red');
    } finally { setUpBusy(false); }
  };
  const dropRef = (id: string) => setF((p) => ({ ...p, refImages: (p.refImages ?? []).filter((x) => x.id !== id) }));
  const suggestTitles = async () => {
    setTitleBusy(true); setTitleSugs(null);
    const camp = campaigns.find((x) => x.id === f.campaignId)?.name;
    const r = await ai.ask({ maxTokens: 700, system: 'Bạn là biên tập viên nội dung B2B tiếng Việt. Chỉ trả về đúng 1 đối tượng JSON hợp lệ, không markdown, không giải thích.', prompt: `Đề xuất 5 tiêu đề bài ${MKT_CH[f.channel].label} (${WRITER[f.contentType].label}) cho ${stCo.name}${stCo.sector ? `, lĩnh vực ${stCo.sector}` : ''}. ${prod ? `Sản phẩm trọng tâm: ${prod.name} (${prod.sku}). ` : ''}${camp ? `Chiến dịch: ${camp}. ` : ''}${f.title.trim() ? `Ý tưởng ban đầu: ${f.title.trim()}. ` : ''}Tiêu đề cụ thể, có lợi ích cho người đọc, dưới 90 ký tự. Trả JSON {"titles":["…"]}` });
    setTitleBusy(false);
    const j = r.ok ? parseAiJson<{ titles?: unknown[] }>(r.text) : null;
    const list = (j?.titles ?? []).map(String).map((x) => x.trim()).filter(Boolean).slice(0, 5);
    if (!list.length) { notify(r.ok ? 'Chưa đọc được gợi ý, bấm lại lần nữa' : `Chưa gợi ý được: ${r.error}`, 'orange'); return; }
    setTitleSugs(list);
  };

  const withImg = skus.filter((x) => x.image && !x.archived);
  const refs = stArr(sv[vKey('imgRef')]);
  const upRefs = f.refImages ?? [];
  const refTotal = upRefs.length + refs.length;
  const mode = stStr(sv.imgMode) === 'detail' ? 'detail' : 'fast';
  const area = (v: string, on: (s: string) => void, ph: string, label: string, min = 'min-h-[72px]') => <textarea className={cn(inputCls, min)} value={v} onChange={(e) => on(e.target.value)} placeholder={ph} aria-label={label} />;

  /** Trường gốc của 3 bước (đặt ở đâu, nhãn gì do bố cục 3A quyết định); null = không áp dụng cho kênh đang chọn */
  const builtin = (key: string, label = ''): ReactNode => {
    switch (key) {
      case 'title': return (
        <div>
          <div className="flex gap-2">
            <input className={cn(inputCls, 'min-w-0 flex-1')} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="VD: 5 lưu ý chọn đầu cáp co nguội cho trạm 24kV" aria-label={label} aria-invalid={tried && !f.title.trim() ? true : undefined} />
            {!ro && ai.available && <button type="button" className={cn(btnGhost, 'shrink-0')} disabled={titleBusy} onClick={() => void suggestTitles()}><Sparkles className={cn('h-4 w-4', titleBusy && 'motion-safe:animate-pulse')} aria-hidden />Gợi ý tiêu đề</button>}
          </div>
          {titleSugs && (
            <ul className="mt-2 space-y-1" aria-label="Tiêu đề gợi ý">
              {titleSugs.map((s) => <li key={s}><button type="button" className="w-full rounded-md border border-[rgb(var(--line))] px-2.5 py-1.5 text-left text-[13px] hover:border-[rgb(var(--ink)/0.3)] hover:bg-[rgb(var(--ink)/0.03)]" onClick={() => { set('title', s); setTitleSugs(null); }}>{s}</button></li>)}
              <li><button type="button" className="text-[12px] text-[rgb(var(--muted))] hover:underline" onClick={() => setTitleSugs(null)}>Ẩn gợi ý</button></li>
            </ul>
          )}
        </div>
      );
      case 'channel': return <select className={inputCls} value={f.channel} onChange={(e) => setChannel(e.target.value as MktChannel)} aria-label={label}>{(Object.keys(MKT_CH) as MktChannel[]).map((k) => <option key={k} value={k}>{MKT_CH[k].label}{ST_OF_CHANNEL[k] ? '' : ' (soạn tự do)'}</option>)}</select>;
      case 'date': return <input type="date" className={inputCls} value={f.date} onChange={(e) => set('date', e.target.value)} aria-label={label} />;
      case 'product': return (
        <div>
          <SelectMenu ariaLabel={label} value={f.productSku ? [f.productSku] : []} disabled={ro} onChange={(v) => pickProduct(v[0])} placeholder="Chọn sản phẩm / dịch vụ…"
            options={skus.filter((x) => !x.archived || x.sku === f.productSku).slice(0, 500).map((x) => ({ id: x.sku, label: `${x.sku} · ${x.name}`, hint: [x.brand, x.unit].filter(Boolean).join(' · ') || undefined, img: x.image }))} />
          {prod && (
            <div className="mt-2 flex items-center gap-2.5 rounded-md bg-[rgb(var(--sunken))] px-2.5 py-2" data-product-card>
              {prod.image ? <img src={prod.image} alt="" className="h-9 w-9 shrink-0 rounded object-cover" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-dashed border-[rgb(var(--line))] text-[rgb(var(--muted))]"><ImagePlus className="h-4 w-4" aria-hidden /></span>}
              <span className="min-w-0 flex-1 text-[12.5px]"><span className="block truncate font-medium">{prod.name}</span><span className="block truncate text-[rgb(var(--muted))]">{prod.image ? 'Có ảnh sản phẩm' : 'Chưa có ảnh sản phẩm'}{prod.brand ? ` · ${prod.brand}` : ''}</span></span>
              {!ro && <button type="button" className="shrink-0 text-[12px] text-[rgb(var(--muted))] hover:underline" onClick={() => pickProduct(undefined)}>Bỏ chọn</button>}
            </div>
          )}
        </div>
      );
      case 'campaign': return <select className={inputCls} value={f.campaignId ?? ''} onChange={(e) => set('campaignId', e.target.value || undefined)} aria-label={label}><option value="">Không gắn</option>{campaigns.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>;
      case 'contentType': return <select className={inputCls} value={f.contentType} onChange={(e) => set('contentType', e.target.value as MktContentType)} aria-label={label}>{(Object.keys(WRITER) as WriterPreset[]).map((k) => <option key={k} value={k}>{WRITER[k].label}</option>)}</select>;
      case 'owner': return <select className={inputCls} value={f.ownerId ?? ''} onChange={(e) => set('ownerId', e.target.value || undefined)} aria-label={label}><option value="">—</option>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>;
      case 'tpl': return pid ? <QuickTemplates chips label={label} platform={pid} values={sv} onChange={setSv} title={f.title} context={f.textPrompt} ro={ro} /> : null;
      case 'brief': return pid
        ? <FormCard title={label}><VariantGroupsGrid kind="text" platform={pid} values={sv} onChange={setSv} ro={ro} adv={false} /></FormCard>
        : <FormCard title={label}>{area(f.textPrompt, (v) => set('textPrompt', v), `Kênh ${MKT_CH[f.channel].label} soạn tự do: đối tượng, thông điệp, ưu đãi, độ dài…`, label)}</FormCard>;
      case 'seo': return pid ? <SeoCard label={label} pid={pid} title={f.title} note={f.textPrompt} sv={sv} onChange={setSv} ro={ro} self={{ taskId: f.id, contentId: live.contentId }} /> : null;
      case 'brand': return pid ? <BrandAccordion label={label} pid={pid} sv={sv} onChange={setSv} missing={brandMiss} ro={ro} /> : null;
      case 'briefAdv': return pid ? <div className="grid grid-cols-2 gap-3">{ST_BRIEF_FIELDS.map((x) => <StFieldControl key={x.key} f={x} value={sv[x.key]} company={stCo} onChange={(v) => setSv({ ...sv, [x.key]: v })} />)}</div> : null;
      case 'textNote': return pid ? area(f.textPrompt, (v) => set('textPrompt', v), 'Góc nhìn, ví dụ thực tế, công trình đã làm…', label, 'min-h-[64px]') : null;
      case 'imgReq': return pid
        ? <FormCard title={label}><VariantGroupsGrid kind="image" platform={pid} values={sv} onChange={setSv} ro={ro} adv={false} /></FormCard>
        : <FormCard title={label}>{area(f.imagePrompt, (v) => set('imagePrompt', v), 'Phong cách, bối cảnh, màu sắc…', label, 'min-h-[56px]')}</FormCard>;
      case 'imgRef': return pid ? (
        <div data-img-ref className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {upRefs.map((r) => (
              <div key={r.id} className="relative" data-ref-image>
                <AttachImg item={r} alt={r.name} className="h-16 w-16 rounded-md border border-[rgb(var(--line))] object-cover" />
                {!ro && <button type="button" className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-[rgb(var(--line))] bg-[rgb(var(--surface))] text-[rgb(var(--muted))] shadow-sm hover:text-[rgb(var(--danger-fg))]" aria-label={`Bỏ ảnh ${r.name}`} onClick={() => dropRef(r.id)}><X className="h-3 w-3" aria-hidden /></button>}
              </div>
            ))}
            {!ro && refTotal < REF_MAX && (
              <FilePicker accept="image/*" disabled={upBusy} onFiles={(fs) => void uploadRef(fs[0])} className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-[rgb(var(--line))] text-[11px] text-[rgb(var(--muted))] hover:border-[rgb(var(--ink)/0.3)] hover:text-[rgb(var(--fg))]">
                {upBusy ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}Tải ảnh
              </FilePicker>
            )}
          </div>
          {withImg.length > 0 && <SelectMenu ariaLabel={`${label} từ danh mục sản phẩm`} multi value={refs} disabled={ro} onChange={(v) => setSv({ ...sv, [vKey('imgRef')]: v.slice(-Math.max(0, REF_MAX - upRefs.length)) })} placeholder={upRefs.length >= REF_MAX ? 'Đã đủ 2 ảnh tham chiếu' : 'Hoặc chọn ảnh từ danh mục sản phẩm…'} options={withImg.slice(0, 200).map((x) => ({ id: x.sku, label: x.sku, hint: x.name, img: x.image }))} />}
          <p className="text-[12px] text-[rgb(var(--muted))]">Tối đa {REF_MAX} ảnh. Ảnh tải lên chỉ dùng cho nhiệm vụ này, không đổi ảnh sản phẩm.</p>
        </div>
      ) : null;
      case 'imgAdv': return pid ? (
        <div className="space-y-3">
          <VariantGroupsGrid kind="image" platform={pid} values={sv} onChange={setSv} ro={ro} adv />
          <div>
            <p className="mb-1 text-xs font-medium text-[rgb(var(--muted))]">Mô hình tạo ảnh</p>
            <Segmented ariaLabel="Mô hình tạo ảnh" value={mode} disabled={ro} onChange={(id) => setSv({ ...sv, imgMode: id })}
              options={[{ id: 'fast', label: 'Nhanh (mặc định)', title: srv.models.image ?? 'gpt-image-2.5-flare' }, { id: 'detail', label: 'Chi tiết cao', title: srv.models.imageDetail ?? 'gpt-image-2.5-sunburst' }]} />
            <p className="mt-1 font-mono text-[11.5px] text-[rgb(var(--muted))]">{mode === 'detail' ? srv.models.imageDetail ?? 'gpt-image-2.5-sunburst' : srv.models.image ?? 'gpt-image-2.5-flare'}{mode === 'detail' ? ' · chậm hơn, chi tiết sản phẩm sắc nét' : ''}</p>
          </div>
        </div>
      ) : null;
      case 'imgNote': return pid ? area(f.imagePrompt, (v) => set('imagePrompt', v), 'Nhân vật, góc chụp, chi tiết cần có…', label, 'min-h-[56px]') : null;
      default: return null;
    }
  };

  const secs = lay.steps[step] ?? [];
  const last = step === 2;
  return (
    <SideSheet title={exists ? 'Nhiệm vụ nội dung' : 'Nhiệm vụ mới'} width="sm:w-[580px]" onClose={onClose}
      sub={<span className="inline-flex items-center gap-1.5" data-task-status={st}><span className="h-2 w-2 rounded-full" style={{ background: TASK_STATUS[st].color }} aria-hidden />{TASK_STATUS[st].label}{content?.aiJob?.step ? ` · ${content.aiJob.step}` : ''}</span>}
      footer={ro ? <button className={btnGhost} onClick={onClose}>Đóng</button> : <>
        {exists && <button type="button" className={cn(btnGhost, 'p-2 text-[rgb(var(--danger-fg))]')} aria-label="Xóa nhiệm vụ" title="Xóa nhiệm vụ" onClick={() => { setMktTasks((p) => p.filter((x) => x.id !== f.id)); onClose(); }}><Trash2 className="h-4 w-4" aria-hidden /></button>}
        <span className="flex-1" />
        {step > 0 && <button type="button" className={btnGhost} onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4" aria-hidden />Quay lại</button>}
        <button type="button" className={btnGhost} onClick={saveDraft}>Lưu nháp</button>
        {!last && <button type="button" className={btnPrimary} onClick={() => setStep(step + 1)}>Tiếp tục<ArrowRight className="h-4 w-4" aria-hidden /></button>}
        <button type="button" className={last ? btnAccent : cn(btnGhost, 'text-[rgb(var(--fg))]')} disabled={busy} title={busy ? TASK_STATUS[st].label : undefined} onClick={give}><Sparkles className="h-4 w-4" aria-hidden />{content ? 'Giao AI làm lại' : 'Giao cho AI xử lý'}</button>
      </>}>
      <StepBar titles={lay.titles} step={step} onStep={setStep} miss={stepMiss} />
      <fieldset disabled={ro} className="min-w-0 space-y-4" data-content-step={step + 1}>
        {tried && curMiss.length > 0 && <p role="alert" className="rounded-lg border border-[rgb(var(--danger)/0.35)] bg-[rgb(var(--danger)/0.06)] px-3 py-2 text-[12.5px] text-[rgb(var(--danger-fg))]">Cần nhập trước khi giao: {curMiss.map((m) => m.label).join(', ')}</p>}
        {secs.length
          ? <DynamicFieldRenderer key={step} mode="edit" sections={secs} avail={lay.avail} required={lay.defs} vals={f.cf} onChange={(k, v: CfVal | undefined) => setF((p) => ({ ...p, cf: cfSet(p.cf, k, v) }))} users={users} nameOf={nameOf} recordId={f.id} builtin={builtin} bare={CT_BARE} />
          : <p className="rounded-md bg-[rgb(var(--sunken))] p-3 text-[13px] text-[rgb(var(--muted))]">Bước này chưa có trường nào</p>}
        {step === 0 && content && (
          <FormCard title="Nội dung đã soạn">
            <p className="font-medium">{content.title}</p>
            <p className="text-xs text-[rgb(var(--muted))]">{content.blocks?.length ?? 0} mục · {content.blocks?.filter((b) => b.image).length ?? 0} ảnh · {CONTENT_STATUS[content.status].label}{content.aiJob?.status === 'FAILED' ? ` · lỗi: ${content.aiJob.error}` : ''}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {content.status !== 'DRAFT' && <button type="button" className={cn(btnPrimary, btnSm)} onClick={() => { onClose(); openContentReview(content.id); }}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />{content.status === 'REVIEW' && canDo('mkt.manage') ? 'Xem & duyệt' : 'Xem bài'}</button>}
              <button type="button" className={cn(btnGhost, btnSm)} onClick={openStudio}><ExternalLink className="h-3.5 w-3.5" aria-hidden />Mở Workspace</button>
            </div>
          </FormCard>
        )}
        {step === 0 && !content && !ro && (
          <div className="flex items-center gap-2 border-t border-[rgb(var(--line))] pt-3 text-[12.5px] text-[rgb(var(--muted))]">
            {f.status === 'PUBLISHED'
              ? <><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /><span className="flex-1">Đã đánh dấu đã đăng (làm ngoài hệ thống)</span><button type="button" className="font-medium text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => set('status', 'PLAN')}>Bỏ đánh dấu</button></>
              : <><span className="flex-1">Bài đã đăng ở ngoài hệ thống?</span><button type="button" className="font-medium text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => set('status', 'PUBLISHED')}>Đánh dấu đã đăng</button></>}
          </div>
        )}
      </fieldset>
    </SideSheet>
  );
}
