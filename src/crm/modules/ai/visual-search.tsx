'use client';

import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { Chip, EmptyState } from '../../components/ui';
import { bizMode, btnGhost, btnSm, featCache, fmtN, fold, imgSim, readAsDataUrl, SKU_FILTER0, stickyStore, useApp, VS_KIND } from '../../lib/core';
import type { ImgFeat, VsHit } from '../../lib/types';
import { cn } from '../../lib/utils';
import { parseAiJson, useAi } from './ai-core';

export function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

/** Đặc trưng ảnh: dHash 64 bit (hình dáng) + biểu đồ màu 4x4x4 (màu sắc) */
export async function imgFeatures(src: string): Promise<ImgFeat | null> {
  if (featCache.has(src)) return featCache.get(src) ?? null;
  try {
    const img = await loadImg(src);
    const c = document.createElement('canvas');
    const x = c.getContext('2d', { willReadFrequently: true });
    if (!x) return null;
    c.width = 9; c.height = 8; x.drawImage(img, 0, 0, 9, 8);
    const g = x.getImageData(0, 0, 9, 8).data;
    const lum = (i: number) => g[i * 4] * 0.299 + g[i * 4 + 1] * 0.587 + g[i * 4 + 2] * 0.114;
    const hash: boolean[] = [];
    for (let r = 0; r < 8; r++) for (let k = 0; k < 8; k++) hash.push(lum(r * 9 + k) > lum(r * 9 + k + 1));
    c.width = 24; c.height = 24; x.drawImage(img, 0, 0, 24, 24);
    const d = x.getImageData(0, 0, 24, 24).data;
    const hist = new Array(64).fill(0);
    for (let i = 0; i < d.length; i += 4) hist[(d[i] >> 6) * 16 + (d[i + 1] >> 6) * 4 + (d[i + 2] >> 6)]++;
    const f = { hash, hist: hist.map((v) => v / 576) };
    featCache.set(src, f);
    return f;
  } catch { featCache.set(src, null); return null; }
}

/** Thu nhỏ ảnh (cạnh dài ≤ 1024px) và trả base64 JPEG để gửi AI */
export async function shrinkForAi(src: string): Promise<{ mediaType: string; data: string; url: string } | null> {
  try {
    const img = await loadImg(src);
    const k = Math.min(1, 1024 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const x = c.getContext('2d'); if (!x) return null;
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', 0.85);
    return { mediaType: 'image/jpeg', data: url.split(',')[1], url };
  } catch { return null; }
}

export function VisualSearchPanel({ file, onReset, onPick }: { file: File; onReset: () => void; onPick: () => void }) {
  const app = useApp();
  const { skus, priceItems, stockItems, jobs, myLeads: leads, customers, company, go } = app;
  const ai = useAi('visual');
  const [src, setSrc] = useState('');
  const [hits, setHits] = useState<VsHit[]>([]);
  const [desc, setDesc] = useState<{ mo_ta?: string; loai?: string; vat_lieu?: string[]; mau_sac?: string } | null>(null);
  const [stage, setStage] = useState<'read' | 'local' | 'ai' | 'done'>('read');
  const [err, setErr] = useState('');
  const mode = bizMode(company);
  useEffect(() => {
    let live = true;
    void (async () => {
      if (!/^image\//.test(file.type)) { setErr('Chỉ nhận file ảnh (JPG, PNG, WEBP). Bản vẽ CAD / SketchUp: xuất ra ảnh PNG / JPG rồi tải lên.'); setStage('done'); return; }
      if (file.size > 15 * 1024 * 1024) { setErr('Ảnh quá lớn (tối đa 15 MB)'); setStage('done'); return; }
      const url = await readAsDataUrl(file);
      if (!live) return;
      setSrc(url); setStage('local');
      const out: VsHit[] = [];
      const push = (h: VsHit) => { const ex = out.find((x) => x.kind === h.kind && x.id === h.id); if (!ex) out.push(h); else if (h.score > ex.score) Object.assign(ex, { score: h.score, why: `${h.why}; ${ex.why}` }); };
      // 1) So khớp ảnh với ảnh đã có trong CRM
      const q = await imgFeatures(url);
      if (q) {
        for (const s of skus.filter((x) => x.image && !x.archived)) { const f = await imgFeatures(s.image!); if (f) { const v = imgSim(q, f); if (v > 0.62) push({ kind: 'SKU', id: s.sku, code: s.sku, name: s.name, sub: `${s.brand} · ${s.category}`, score: Math.round(v * 100), why: 'Ảnh giống ảnh sản phẩm', img: s.image }); } }
        for (const j of jobs) for (const jf of j.files.filter((x) => /^data:image|\.(png|jpe?g|webp)(\?|$)/i.test(x.url)).slice(0, 6)) { const f = await imgFeatures(jf.url); if (f) { const v = imgSim(q, f); if (v > 0.62) push({ kind: 'JOB', id: j.id, code: j.code, name: j.title, sub: jf.kind === 'DRAWING' ? 'Bản vẽ công trình' : 'Ảnh công trình', score: Math.round(v * 100), why: jf.kind === 'DRAWING' ? 'Giống bản vẽ đã lưu' : 'Giống ảnh công trình đã lưu', img: jf.url }); } }
      }
      // 2) Từ khóa trong tên file (vd. tu-bep-chu-L.jpg)
      const toks = fold(file.name.replace(/\.[a-z0-9]+$/i, '')).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !/^(img|image|anh|photo|screenshot|scan|dsc|zalo|pxl|\d+)$/.test(w));
      if (toks.length) {
        const hitN = (s: string) => toks.filter((w) => fold(s).includes(w)).length;
        skus.filter((s) => !s.archived).forEach((s) => { const n = hitN(`${s.sku} ${s.name} ${s.category}`); if (n) push({ kind: 'SKU', id: s.sku, code: s.sku, name: s.name, sub: s.category, score: 40 + Math.min(40, n * 15), why: 'Khớp từ khóa tên ảnh', img: s.image }); });
        priceItems.filter((p) => p.active).forEach((p) => { const n = hitN(`${p.code} ${p.name} ${p.category}`); if (n) push({ kind: 'PRICE', id: p.id, code: p.code, name: p.name, sub: `${p.category} · ${fmtN(p.price)}đ/${p.unit}`, score: 40 + Math.min(40, n * 15), why: 'Khớp từ khóa tên ảnh' }); });
        jobs.forEach((j) => { const n = hitN(`${j.code} ${j.title}`); if (n) push({ kind: 'JOB', id: j.id, code: j.code, name: j.title, sub: j.siteAddress, score: 35 + Math.min(40, n * 12), why: 'Khớp từ khóa tên ảnh' }); });
      }
      if (!live) return;
      setHits([...out].sort((a, b) => b.score - a.score));
      // 3) AI nhận diện và đối chiếu danh mục
      if (ai.available) {
        setStage('ai');
        const img = await shrinkForAi(url);
        const cat = [
          ...(mode !== 'MFG' ? skus.filter((s) => !s.archived).slice(0, 400).map((s) => `SKU|${s.sku}|${s.name}|${s.category}|${s.brand}`) : []),
          ...(mode !== 'TRADING' ? priceItems.filter((p) => p.active).slice(0, 200).map((p) => `HANGMUC|${p.code}|${p.name}|${p.category}`) : []),
          ...stockItems.filter((s) => s.active).slice(0, 200).map((s) => `VATTU|${s.code}|${s.name}|${s.category}`),
          ...jobs.slice(-120).map((j) => `DONHANG|${j.code}|${j.title}|${(j.draft ?? []).map((l) => l.name).slice(0, 4).join(', ')}`),
          ...leads.filter((l) => l.boqNote).slice(-80).map((l) => `DUAN|${l.code}|${l.company}|${l.boqNote.slice(0, 80)}`),
        ].join('\n');
        const r = img ? await ai.ask({
          image: { mediaType: img.mediaType, data: img.data }, maxTokens: 1200,
          system: 'Bạn là chuyên gia nhận diện sản phẩm nội thất, nhôm kính, tủ bếp, vật tư điện và phụ kiện 3M. Phân tích ảnh (có thể là ảnh thật, bản vẽ CAD hoặc ảnh dựng SketchUp) rồi đối chiếu với danh mục. Chỉ trả về JSON.',
          prompt: `Danh mục (LOẠI|MÃ|TÊN|NHÓM...):\n${cat}\n\nTrả về JSON dạng {"mo_ta":"mô tả ngắn","loai":"loại sản phẩm / hạng mục","vat_lieu":["..."],"mau_sac":"...","ket_qua":[{"ma":"MÃ trong danh mục","ly_do":"vì sao giống","diem":0-100}]} tối đa 8 kết quả, chỉ dùng mã có trong danh mục.`,
        }) : { ok: false as const, error: 'Không đọc được ảnh' };
        if (!live) return;
        if (r.ok) {
          const j = parseAiJson<{ mo_ta?: string; loai?: string; vat_lieu?: string[]; mau_sac?: string; ket_qua?: { ma: string; ly_do?: string; diem?: number }[] }>(r.text);
          if (j) {
            setDesc(j);
            (j.ket_qua ?? []).forEach((k) => {
              const code = String(k.ma ?? '').trim();
              const why = `AI: ${k.ly_do ?? 'tương đồng'}`;
              const sc = Math.max(1, Math.min(100, Number(k.diem) || 60));
              const s = skus.find((x) => x.sku === code); if (s) push({ kind: 'SKU', id: s.sku, code: s.sku, name: s.name, sub: `${s.brand} · ${s.category}`, score: sc, why, img: s.image });
              const p = priceItems.find((x) => x.code === code); if (p) push({ kind: 'PRICE', id: p.id, code: p.code, name: p.name, sub: `${p.category} · ${fmtN(p.price)}đ/${p.unit}`, score: sc, why });
              const st = stockItems.find((x) => x.code === code); if (st) push({ kind: 'STOCK', id: st.id, code: st.code, name: st.name, sub: st.category, score: sc, why });
              const jb = jobs.find((x) => x.code === code); if (jb) push({ kind: 'JOB', id: jb.id, code: jb.code, name: jb.title, sub: customers.find((c) => c.id === jb.customerId)?.name, score: sc, why });
              const ld = leads.find((x) => x.code === code); if (ld) push({ kind: 'LEAD', id: ld.id, code: ld.code, name: ld.company, sub: ld.boqNote, score: sc, why });
            });
            setHits([...out].sort((a, b) => b.score - a.score));
          } else setErr('AI trả lời không đúng định dạng, đang hiển thị kết quả so khớp cục bộ');
        } else setErr(`AI chưa phân tích được: ${r.error}`);
      }
      setStage('done');
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);
  const open = (h: VsHit) => {
    onPick();
    if (h.kind === 'SKU') { stickyStore.set('SkuCatalog.f', { ...SKU_FILTER0, q: h.code }); stickyStore.set('SkuCatalog.view', 'ALL'); go('products'); }
    else if (h.kind === 'PRICE') { stickyStore.set('SettingsModule.tab', 'pricing'); go('settings'); }
    else if (h.kind === 'STOCK') go('inventory', h.code);
    else if (h.kind === 'JOB') app.openJob(h.id);
    else go('projects', h.code);
  };
  return (
    <div className="max-h-[60vh] overflow-y-auto p-4">
      <div className="flex gap-4">
        {src ? <img src={src} alt="Ảnh cần tìm" className="h-28 w-28 shrink-0 rounded-md border border-[rgb(var(--line))] object-cover" /> : <div className="h-28 w-28 shrink-0 animate-pulse rounded-md bg-[rgb(var(--ink)/0.06)]" />}
        <div className="min-w-0 flex-1 text-sm">
          <p className="truncate font-semibold">{file.name}</p>
          <p className="text-xs text-[rgb(var(--muted))]">{stage === 'read' ? 'Đang đọc ảnh…' : stage === 'local' ? 'Đang so khớp với ảnh trong CRM…' : stage === 'ai' ? `${ai.label} đang nhận diện và đối chiếu danh mục…` : `${hits.length} kết quả · ${ai.available ? `so khớp ảnh + ${ai.label}` : 'so khớp ảnh + tên file (chưa kết nối AI)'}`}</p>
          {desc && <div className="mt-2 rounded-md bg-[rgb(var(--secondary)/0.07)] px-3 py-2 text-xs"><b>{desc.loai}</b>{desc.mo_ta ? `: ${desc.mo_ta}` : ''}{desc.vat_lieu?.length ? <span className="block text-[rgb(var(--muted))]">Vật liệu: {desc.vat_lieu.join(', ')}{desc.mau_sac ? ` · màu ${desc.mau_sac}` : ''}</span> : null}</div>}
          {err && <p className="mt-2 text-xs text-[rgb(var(--danger-fg))]">{err}</p>}
          <button className={cn(btnGhost, btnSm, 'mt-2')} onClick={onReset}>Chọn ảnh khác</button>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5">
        {hits.slice(0, 12).map((h) => (
          <li key={`${h.kind}${h.id}`}>
            <button className="flex w-full items-center gap-3 rounded-md border border-[rgb(var(--line))] px-3 py-2 text-left hover:border-[rgb(var(--secondary)/0.6)] hover:bg-[rgb(var(--secondary)/0.05)]" onClick={() => open(h)}>
              {h.img ? <img src={h.img} alt="" className="h-10 w-10 shrink-0 rounded object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[rgb(var(--ink)/0.05)]"><Package className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden /></span>}
              <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><Chip tone="blue">{VS_KIND[h.kind]}</Chip><b className="code-chip">{h.code}</b></span><span className="mt-0.5 block truncate text-sm">{h.name}</span><span className="block truncate text-[11px] text-[rgb(var(--muted))]">{h.why}{h.sub ? ` · ${h.sub}` : ''}</span></span>
              <span className="w-16 shrink-0 text-right"><span className="font-num text-sm font-semibold">{h.score}%</span><span className="mt-1 block h-1 rounded-full bg-[rgb(var(--line))]"><span className="block h-1 rounded-full bg-[rgb(var(--accent))]" style={{ width: `${h.score}%` }} /></span></span>
            </button>
          </li>
        ))}
        {stage === 'done' && !hits.length && !err && <li><EmptyState compact art="search" text="Chưa tìm thấy sản phẩm tương đồng" hint={ai.available ? 'Thử ảnh rõ hơn, chụp thẳng, đủ sáng.' : 'Kết nối AI (Cài đặt > AI & Zalo) để nhận diện ảnh chưa có trong CRM.'} /></li>}
      </ul>
    </div>
  );
}

