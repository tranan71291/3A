'use client';

import { Extension, type AnyExtension, type Editor, type JSONContent } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import TiptapImage from '@tiptap/extension-image';
import StarterKit from '@tiptap/starter-kit';
import { type Node as PMNode } from '@tiptap/pm/model';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { CheckCircle2, ChevronDown, Copy, Download, ExternalLink, Eye, ImagePlus, Lock, Pencil, RefreshCw, Search, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { removeWithUndo } from '../../app/context';
import { RowMenu } from '../../components/controls';
import { Chip, Field, MoneyInput, Panel, SideSheet, useSticky } from '../../components/ui';
import { btnAccent, btnGhost, btnPrimary, btnSm, CAMP_STATUS, cloneContent, cloud, CLOUD_ON, compact, CONTENT_STATUS, CONTENT_TEMPLATES, contentBusy, contentExportItems, countOf, CV_KIND, CV_MAX, dataKb, dayMs, downloadBlob, downloadData, esc, fmtDate, GHOST_PREF, ghostEligible, ghostPrefOff, HS_CLICHES_DEFAULT, IMG_SIZES, inputBase, inputCls, isoDay, maskPii, MKT_CH, MKT_IMG_MAX, MKT_OPEN_EVT, MKT_REVIEW_EVT, openContentReview, SeoSidebar, slugify, ST_BRAND, ST_BRIEF_FIELDS, ST_OF_CHANNEL, ST_VARIANT_CACHE, stArr, stCompanyOf, stEsc, stFold, stHas, stickyStore, stSectionPrompt, stStr, TASK_STATUS, todayISO, uid, useApp, VARIANT_GROUPS, vAspect, vCfgOf, vImg, vKey, WRITER, WS_BLOCK_TYPES, WS_CSS, WS_GHOST, WS_MARKS, WS_TONES, wsClamp, wsCleanAi, wsHeadKey, wsId, wsImages, wsInlineMd, wsPara, wsPushVersion, wsSafeHref, wsSecKey, wsSentences, wsText, wsWords } from '../../lib/core';
import type { AiQuotaCfg, AnyRec, Campaign, CampaignStatus, ConfirmState, ContentVariantCfg, ContentVersion, ContentVersionKind, HumanBlock, HumanReport, MenuOption, MktChannel, MktContent, MktContentType, MktImage, MktTask, Module, StArticle, StCompany, StSection, StSettings, StudioApi, TaskStatus, User, VariantGroup, VariantKind, WriterPreset, WsBlock, WsDiffPart, WsGhost, WsImagePanel, WsMarks, WsProposal, WsSlash, WsSlashItem, WsTone } from '../../lib/types';
import { cn } from '../../lib/utils';
import { parseAiJson, useAi } from '../ai/ai-core';
import { applyWatermark, contentToArticle, getPlatform, scoreArticle, stClip, StFieldControl, stShrinkImage, useStudio, useStudioActions, useStudioApi, useStudioPort } from './content-studio';
import { AudienceBuilder, AutomationList, BannerStudio, taskStatusOf, useAssignToAi } from './marketing-hub';
import { Switch } from '../platform/console';
import { docShell, downloadWord, printHtml } from '../sales/templates';

/** "**đậm** thường" -> các nút chữ có dấu đậm */
export function wsInline(s: string): JSONContent[] {
  const out: JSONContent[] = [];
  s.split(/(\*\*[^*]+\*\*)/g).forEach((part) => {
    if (!part) return;
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    out.push(m ? { type: 'text', text: m[1], marks: [{ type: 'bold' }] } : { type: 'text', text: part });
  });
  return out;
}

/** Markdown nhẹ của v37 (đoạn, **đậm**, "- " gạch đầu dòng, "1. ", "> ") -> các khối TipTap */
export function wsMdToNodes(md: string): JSONContent[] {
  const out: JSONContent[] = [];
  for (const chunk of md.replace(/\r/g, '').split(/\n{2,}/)) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const item = (t: string): JSONContent => ({ type: 'listItem', content: [wsPara(t)] });
    if (lines.every((l) => /^[-*•]\s+/.test(l))) out.push({ type: 'bulletList', content: lines.map((l) => item(l.replace(/^[-*•]\s+/, ''))) });
    else if (lines.every((l) => /^\d+[.)]\s+/.test(l))) out.push({ type: 'orderedList', content: lines.map((l) => item(l.replace(/^\d+[.)]\s+/, ''))) });
    else if (lines.every((l) => l.startsWith('>'))) out.push({ type: 'blockquote', content: [wsPara(lines.map((l) => l.replace(/^>\s?/, '')).join(' '))] });
    else out.push(wsPara(lines.join(' ')));
  }
  return out;
}

/** Một khối -> markdown nhẹ (để kênh mạng xã hội, chấm SEO và prompt AI dùng tiếp như v37) */
export function wsNodeMd(n: JSONContent): string {
  switch (n.type) {
    case 'paragraph': case 'heading': return wsInlineMd(n);
    case 'bulletList': return (n.content ?? []).map((li) => `- ${(li.content ?? []).map(wsInlineMd).join(' ')}`).join('\n');
    case 'orderedList': return (n.content ?? []).map((li, i) => `${i + 1}. ${(li.content ?? []).map(wsInlineMd).join(' ')}`).join('\n');
    case 'blockquote': return (n.content ?? []).map((c) => `> ${wsInlineMd(c)}`).join('\n');
    default: return '';
  }
}

/** Dàn ý + nội dung v37 -> tài liệu TipTap (bài cũ mở lần đầu ở v38) */
export function wsArticleToDoc(a: StArticle): JSONContent {
  const content: JSONContent[] = [];
  for (const s of a.sections) {
    content.push({ type: 'heading', attrs: { level: s.level, id: s.id }, content: s.title ? [{ type: 'text', text: s.title }] : undefined });
    if (s.image) content.push({ type: 'image', attrs: { src: s.image.url, alt: s.image.alt, title: null, caption: null, fileName: null } });
    content.push(...wsMdToNodes(s.body));
  }
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

/**
 * Ghép tài liệu khi dàn ý đổi ở Bước 2 (thêm / bớt / đổi thứ tự / đổi tên mục): mục còn tồn tại giữ nguyên
 * nội dung đã định dạng trong doc cũ, mục mới dựng từ markdown. Không mất chữ đã viết.
 */
export function wsMergeDoc(old: JSONContent, a: StArticle): JSONContent {
  const bodies = new Map<string, JSONContent[]>();
  const lead: JSONContent[] = [];
  let cur: JSONContent[] = lead;
  for (const n of old.content ?? []) {
    if (n.type === 'heading') { cur = []; bodies.set(String(n.attrs?.id ?? ''), cur); } else cur.push(n);
  }
  const content: JSONContent[] = lead.filter((n) => wsText(n).trim() || n.type === 'image');
  for (const s of a.sections) {
    content.push({ type: 'heading', attrs: { level: s.level, id: s.id }, content: s.title ? [{ type: 'text', text: s.title }] : undefined });
    const b = bodies.get(s.id);
    if (b) content.push(...b);
    else { if (s.image) content.push({ type: 'image', attrs: { src: s.image.url, alt: s.image.alt } }); content.push(...wsMdToNodes(s.body)); }
  }
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

/** Tài liệu dùng cho Workspace: có doc khớp dàn ý thì dùng, khác thì ghép, chưa có thì dựng */
export function wsEnsureDoc(a: StArticle): JSONContent {
  if (!a.doc) return wsArticleToDoc(a);
  return wsHeadKey(a.doc) === wsSecKey(a) ? a.doc : wsMergeDoc(a.doc, a);
}

/** Doc -> sections (giữ API v37: PlatformStrategy.render, prompt, chấm SEO vẫn đọc sections) */
export function wsDocToSections(d: JSONContent, prev: StSection[]): StSection[] {
  const old = new Map(prev.map((s) => [s.id, s]));
  const out: StSection[] = [];
  const lead: string[] = [];
  let cur: { s: StSection; parts: string[] } | null = null;
  const flush = () => { if (cur) { cur.s.body = cur.parts.filter(Boolean).join('\n\n'); out.push(cur.s); } };
  for (const n of d.content ?? []) {
    if (n.type === 'heading') {
      flush();
      const id = String(n.attrs?.id ?? '') || wsId();
      cur = { s: { id, level: n.attrs?.level === 3 ? 3 : 2, title: wsText(n).trim(), body: '' }, parts: [] };
      continue;
    }
    if (n.type === 'image') {
      if (cur && !cur.s.image) {
        const src = String(n.attrs?.src ?? '');
        const was = old.get(cur.s.id)?.image;
        cur.s.image = was && was.url === src ? { ...was, alt: String(n.attrs?.alt ?? was.alt) } : { url: src, prompt: '', alt: String(n.attrs?.alt ?? ''), brandPalette: false, watermarked: false, createdAt: Date.now() };
      }
      continue;
    }
    const md = wsNodeMd(n);
    if (cur) cur.parts.push(md); else lead.push(md);
  }
  flush();
  const leadText = lead.filter(Boolean).join('\n\n');
  if (leadText) {
    if (out.length) out[0] = { ...out[0], body: [leadText, out[0].body].filter(Boolean).join('\n\n') };
    else out.push({ id: 'lead', level: 2, title: '', body: leadText });
  }
  return out;
}

export function wsInlineHtml(n: JSONContent): string {
  if (n.type === 'hardBreak') return '<br/>';
  if (n.type !== 'text') return (n.content ?? []).map(wsInlineHtml).join('');
  let h = stEsc(n.text ?? '');
  for (const m of n.marks ?? []) {
    if (m.type === 'bold') h = `<strong>${h}</strong>`;
    else if (m.type === 'italic') h = `<em>${h}</em>`;
    else if (m.type === 'underline') h = `<u>${h}</u>`;
    else if (m.type === 'link') h = `<a href="${stEsc(wsSafeHref(String(m.attrs?.href ?? '')))}" rel="noopener">${h}</a>`;
  }
  return h;
}

/** Doc -> HTML xuất bản Website: H2/H3, đoạn, danh sách, trích dẫn, ảnh có alt + chú thích + tên file chuẩn SEO */
export function wsDocHtml(d: JSONContent): string {
  const li = (n: JSONContent) => `<li>${(n.content ?? []).map(wsInlineHtml).join(' ')}</li>`;
  return (d.content ?? []).map((n) => {
    switch (n.type) {
      case 'heading': return `<h${n.attrs?.level === 3 ? 3 : 2}>${wsInlineHtml(n)}</h${n.attrs?.level === 3 ? 3 : 2}>`;
      case 'paragraph': { const h = wsInlineHtml(n); return h.trim() ? `<p>${h}</p>` : ''; }
      case 'bulletList': return `<ul>${(n.content ?? []).map(li).join('')}</ul>`;
      case 'orderedList': return `<ol>${(n.content ?? []).map(li).join('')}</ol>`;
      case 'blockquote': return `<blockquote>${(n.content ?? []).map((c) => `<p>${wsInlineHtml(c)}</p>`).join('')}</blockquote>`;
      case 'horizontalRule': return '<hr/>';
      case 'image': {
        const a = n.attrs ?? {};
        const cap = String(a.caption ?? a.title ?? '');
        return `<figure><img src="${stEsc(String(a.src ?? ''))}" alt="${stEsc(String(a.alt ?? ''))}"${a.fileName ? ` data-file-name="${stEsc(String(a.fileName))}"` : ''} loading="lazy"/>${cap ? `<figcaption>${stEsc(cap)}</figcaption>` : ''}</figure>`;
      }
      default: return '';
    }
  }).filter(Boolean).join('\n');
}

export function wsBlocks(d: JSONContent | undefined): WsBlock[] {
  let heading = '';
  return (d?.content ?? []).map((n) => {
    if (n.type === 'heading') heading = wsText(n);
    return { id: String(n.attrs?.id ?? ''), type: n.type ?? '', text: n.type === 'image' ? `[Ảnh] ${String(n.attrs?.alt ?? '')}` : wsText(n), heading };
  });
}

export function wsCv(a: number[]): number {
  if (a.length < 2) return 0;
  const m = a.reduce((s, x) => s + x, 0) / a.length;
  if (!m) return 0;
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length) / m;
}

/** Độ đa dạng từ vựng trên cửa sổ trượt 50 từ (không phụ thuộc độ dài bài) */
export function wsMattr(w: string[], win = 50): number {
  if (w.length < 10) return 0.7;
  if (w.length <= win) return new Set(w).size / w.length;
  let sum = 0, n = 0;
  for (let i = 0; i + win <= w.length; i += 10) { sum += new Set(w.slice(i, i + win)).size / win; n++; }
  return sum / n;
}

export function wsClicheHits(text: string, list: string[]): string[] {
  const t = stFold(text);
  const hits: string[] = [];
  for (const raw of list) {
    const c = stFold(raw).trim();
    if (!c) continue;
    if (c.includes('...')) {
      const [a, b] = c.split('...').map((x) => x.trim());
      const re = new RegExp(`${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.{1,80}?${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
      (t.match(re) ?? []).forEach(() => hits.push(raw));
    } else {
      let i = t.indexOf(c);
      while (i >= 0) { hits.push(raw); i = t.indexOf(c, i + c.length); }
    }
  }
  return hits;
}

/**
 * Human Score 0–100, tính trong trình duyệt:
 *  câu dài ngắn xen kẽ (burstiness) 30% · đa dạng từ vựng 20% · ít cụm 3 từ lặp lại 15% · ít cụm sáo 25% · đoạn văn không đều nhau 10%.
 * Đoạn ≥ 25 từ có điểm < 55 được đánh dấu "cần biên tập".
 */
export function wsHumanReport(blocks: WsBlock[], cliches: string[]): HumanReport {
  const prose = blocks.filter((b) => ['paragraph', 'blockquote', 'bulletList', 'orderedList'].includes(b.type) && b.text.trim());
  const all = prose.map((b) => b.text).join('\n');
  const words = wsWords(all);
  if (words.length < 40) return { score: 0, weakPct: 0, scored: 0, blocks: [], metrics: [] };
  const sentLens = wsSentences(all).map((s) => wsWords(s).length);
  const burst = sentLens.length >= 3 ? wsClamp(wsCv(sentLens) / 0.55) : 0.5;
  const diversity = wsClamp((wsMattr(words) - 0.5) / 0.3);
  const tri = new Map<string, number>();
  for (let i = 0; i + 2 < words.length; i++) { const k = `${words[i]} ${words[i + 1]} ${words[i + 2]}`; tri.set(k, (tri.get(k) ?? 0) + 1); }
  const repeated = [...tri.values()].filter((v) => v > 1).reduce((s, v) => s + v, 0) / Math.max(1, words.length - 2);
  const repetition = 1 - wsClamp(repeated / 0.12);
  const hits = wsClicheHits(all, cliches);
  const cliche = 1 - wsClamp((hits.length / words.length) * 100 / 2.5);
  const paraSent = prose.filter((b) => b.type === 'paragraph').map((b) => wsSentences(b.text).length).filter((n) => n > 0);
  const uniformity = paraSent.length >= 3 ? wsClamp(wsCv(paraSent) / 0.45) : 0.6;
  const score = Math.round(100 * (0.3 * burst + 0.2 * diversity + 0.15 * repetition + 0.25 * cliche + 0.1 * uniformity));

  const scored: HumanBlock[] = [];
  for (const b of prose) {
    const w = wsWords(b.text);
    if (w.length < 25) continue;
    const lens = wsSentences(b.text).map((s) => wsWords(s).length);
    const bb = lens.length >= 2 ? wsClamp(wsCv(lens) / 0.55) : 0.35;
    const h = wsClicheHits(b.text, cliches);
    const cc = 1 - wsClamp((h.length / w.length) * 100 / 2.5);
    const dd = wsClamp((wsMattr(w) - 0.5) / 0.3);
    const s = Math.round(100 * (0.45 * bb + 0.35 * cc + 0.2 * dd));
    const reasons = [...(bb < 0.45 ? ['Câu dài đều nhau'] : []), ...(h.length ? [`Cụm sáo: ${[...new Set(h)].slice(0, 3).join(', ')}`] : []), ...(dd < 0.35 ? ['Lặp từ nhiều'] : [])];
    scored.push({ id: b.id, heading: b.heading, score: s, words: w.length, reasons });
  }
  const weak = scored.filter((b) => b.score < 55);
  return {
    score, scored: scored.length, weakPct: scored.length ? Math.round((weak.length / scored.length) * 100) : 0, blocks: weak.sort((a, b) => a.score - b.score),
    metrics: [
      { label: 'Câu dài ngắn xen kẽ', value: burst, hint: 'Văn máy thường có câu dài đều nhau' },
      { label: 'Đa dạng từ vựng', value: diversity, hint: 'Tỷ lệ từ khác nhau trên mỗi 50 từ' },
      { label: 'Ít lặp cụm từ', value: repetition, hint: 'Cụm 3 từ xuất hiện nhiều lần' },
      { label: 'Ít cụm sáo', value: cliche, hint: hits.length ? `${hits.length} cụm: ${[...new Set(hits)].slice(0, 4).join(', ')}` : 'Không thấy cụm sáo trong danh sách' },
      { label: 'Đoạn văn không rập khuôn', value: uniformity, hint: 'Đoạn nào cũng cùng số câu là dấu hiệu văn máy' },
    ],
  };
}

export function wsDiff(a: string, b: string): WsDiffPart[] {
  const A = a.split(/(\s+)/).filter(Boolean), B = b.split(/(\s+)/).filter(Boolean);
  const n = A.length, m = B.length;
  if (n * m > 2_500_000) return [{ t: 'del', s: a }, { t: 'ins', s: b }];
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: WsDiffPart[] = [];
  const push = (t: WsDiffPart['t'], s: string) => { const last = out[out.length - 1]; if (last && last.t === t) last.s += s; else out.push({ t, s }); };
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { push('eq', A[i]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) push('del', A[i++]); else push('ins', B[j++]);
  }
  while (i < n) push('del', A[i++]);
  while (j < m) push('ins', B[j++]);
  return out;
}

/** Số liệu (kể cả đơn vị %, °C, mm), mã sản phẩm (VHB 4910, QT-III, 24kV) và từ khóa có trong bản gốc nhưng mất ở bản mới */
export function wsLost(orig: string, next: string, keywords: string[]): string[] {
  const norm = (s: string) => s.replace(/\s+/g, '').replace(/,/g, '.').toLowerCase();
  const nx = norm(next);
  const nums = orig.match(/\d+(?:[.,]\d+)*\s?(?:%|°C|°|mm|cm|m|kg|kV|V|A|W|tr|triệu|tỷ|đ)?/g) ?? [];
  const codes = orig.match(/\b[A-Z][A-Za-z0-9]*[-/]?[A-Z0-9]*\d[A-Z0-9-]*\b|\b\d+[A-Z]{1,3}\b/g) ?? [];
  const lost = [...new Set([...nums, ...codes].map((x) => x.trim()))].filter((x) => x && !nx.includes(norm(x)));
  const kw = keywords.filter((k) => k.trim() && stHas(orig, k) && !stHas(next, k)).map((k) => `"${k}"`);
  return [...lost, ...kw];
}

export function wsExtensions(placeholder: string): AnyExtension[] {
  /** Gắn data-id cho mỗi khối cấp 1: dàn ý, bình luận, Humanize, so sánh phiên bản bám theo id, không theo vị trí */
  const BlockId = Extension.create({
    name: 'wsBlockId',
    addGlobalAttributes() {
      return [{ types: WS_BLOCK_TYPES, attributes: { id: { default: null, keepOnSplit: false, parseHTML: (el: HTMLElement) => el.getAttribute('data-id'), renderHTML: (a: Record<string, any>) => (a.id ? { 'data-id': a.id } : {}) } } }];
    },
    addProseMirrorPlugins() {
      return [new Plugin({
        key: new PluginKey('ws-block-id'),
        appendTransaction: (trs: readonly Transaction[], _old: EditorState, st: EditorState) => {
          if (!trs.some((t) => t.docChanged)) return null;
          const seen = new Set<string>();
          const box: { tr: Transaction | null } = { tr: null };
          st.doc.forEach((node, offset) => {
            if (!WS_BLOCK_TYPES.includes(node.type.name)) return;
            const id = node.attrs.id as string | null;
            if (id && !seen.has(id)) { seen.add(id); return; }
            const nid = wsId(); seen.add(nid);
            box.tr = (box.tr ?? st.tr).setNodeMarkup(offset, undefined, { ...node.attrs, id: nid });
          });
          return box.tr;
        },
      })];
    },
  });
  /** Gợi ý viết tiếp hiện mờ ở con trỏ; mọi thay đổi tài liệu / di chuyển con trỏ đều hủy gợi ý */
  const Ghost = Extension.create({
    name: 'wsGhost',
    addProseMirrorPlugins() {
      return [new Plugin<WsGhost>({
        key: WS_GHOST,
        state: {
          init: () => null,
          apply: (tr: Transaction, v: WsGhost) => { const m = tr.getMeta(WS_GHOST) as WsGhost | undefined; if (m !== undefined) return m; return tr.docChanged || tr.selectionSet ? null : v; },
        },
        props: {
          decorations: (state: EditorState) => {
            const g = WS_GHOST.getState(state);
            if (!g || g.pos > state.doc.content.size) return null;
            return DecorationSet.create(state.doc, [Decoration.widget(g.pos, () => { const s = document.createElement('span'); s.className = 'ws-ghost'; s.textContent = g.text; s.setAttribute('aria-hidden', 'true'); return s; }, { side: 1, key: `ghost-${g.pos}-${g.text.length}` })]);
          },
        },
      })];
    },
  });
  /** Tô viền đoạn cần biên tập (Human Score), tô nền đoạn gợi ý chèn LSI, chữ gợi ý ở dòng trống */
  const Marks = Extension.create({
    name: 'wsMarks',
    addProseMirrorPlugins() {
      return [new Plugin<WsMarks>({
        key: WS_MARKS,
        state: {
          init: () => ({ weak: [], hit: [] }),
          apply: (tr: Transaction, v: WsMarks) => { const m = tr.getMeta(WS_MARKS) as Partial<WsMarks> | undefined; return m ? { ...v, ...m } : v; },
        },
        props: {
          decorations: (state: EditorState) => {
            const v = WS_MARKS.getState(state) ?? { weak: [], hit: [] };
            const decos: Decoration[] = [];
            if (v.weak.length || v.hit.length) {
              state.doc.forEach((node, pos) => {
                const id = node.attrs.id as string | null;
                if (!id) return;
                const cls = [v.weak.includes(id) ? 'ws-weak' : '', v.hit.includes(id) ? 'ws-hit' : ''].filter(Boolean).join(' ');
                if (cls) decos.push(Decoration.node(pos, pos + node.nodeSize, { class: cls }));
              });
            }
            const sel = state.selection;
            const $f = sel.$from;
            if (sel.empty && $f.depth > 0 && $f.parent.isTextblock && $f.parent.content.size === 0 && $f.parent.type.name === 'paragraph') decos.push(Decoration.node($f.before(), $f.after(), { class: 'ws-empty', 'data-placeholder': placeholder }));
            return decos.length ? DecorationSet.create(state.doc, decos) : null;
          },
        },
      })];
    },
  });
  const Img = TiptapImage.extend({
    addAttributes() {
      return {
        ...(this.parent?.() ?? {}),
        caption: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute('data-caption'), renderHTML: (a: Record<string, any>) => (a.caption ? { 'data-caption': a.caption } : {}) },
        fileName: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute('data-file-name'), renderHTML: (a: Record<string, any>) => (a.fileName ? { 'data-file-name': a.fileName } : {}) },
      };
    },
  }).configure({ allowBase64: true, inline: false });
  return [
    StarterKit.configure({ heading: { levels: [2, 3] }, codeBlock: false, code: false, link: { openOnClick: false, autolink: true } }),
    Img, BlockId, Ghost, Marks,
  ];
}

/** Vị trí khối cấp 1 theo id */
export function wsFindBlock(editor: Editor, id: string): { pos: number; node: PMNode } | null {
  let hit: { pos: number; node: PMNode } | null = null;
  editor.state.doc.forEach((node, pos) => { if (!hit && node.attrs.id === id) hit = { pos, node }; });
  return hit;
}

/** Khoảng nội dung của một mục: từ sau tiêu đề tới trước tiêu đề kế tiếp */
export function wsSectionRange(editor: Editor, headingId: string): { from: number; to: number; empty: boolean } | null {
  const doc = editor.state.doc;
  let start = -1, end = doc.content.size, text = '';
  doc.forEach((node, pos) => {
    if (start < 0) { if (node.type.name === 'heading' && node.attrs.id === headingId) start = pos + node.nodeSize; return; }
    if (end !== doc.content.size) return;
    if (node.type.name === 'heading') end = pos; else text += node.textContent + (node.type.name === 'image' ? 'img' : '');
  });
  return start < 0 ? null : { from: start, to: end, empty: !text.trim() };
}

// ---- workspace/net.ts: gọi máy chủ có hủy yêu cầu (ghost text) ----

export async function wsFetch<T>(path: string, init: { method: 'GET' | 'POST'; body?: AnyRec; signal?: AbortSignal }): Promise<T & { ok: boolean; error?: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (CLOUD_ON && cloud.session?.access_token) headers.Authorization = `Bearer ${cloud.session.access_token}`;
  try {
    const r = await fetch(path, { method: init.method, headers, body: init.body ? JSON.stringify(init.body) : undefined, signal: init.signal, cache: 'no-store' });
    return (await r.json().catch(() => ({ ok: false, error: r.status === 404 ? 'not_found' : `http_${r.status}` }))) as T & { ok: boolean; error?: string };
  } catch (e) {
    return { ok: false, error: e instanceof DOMException && e.name === 'AbortError' ? 'aborted' : 'network' } as T & { ok: boolean; error?: string };
  }
}

/** Mốc lịch sử từ trạng thái bài hiện tại */
export function wsMakeVersion(a: StArticle, company: StCompany, contentId: string, kind: ContentVersionKind, by: string, cliches: string[], note?: string): ContentVersion | null {
  const doc = a.doc ?? wsArticleToDoc(a);
  if (!a.title.trim()) return null;
  const seo = scoreArticle({ ...a, doc }, getPlatform(a.platform), company).score;
  const human = wsHumanReport(wsBlocks(doc), cliches).score;
  return { id: uid('cv'), contentId, kind, title: a.title, doc, seoScore: seo, humanScore: human, by, at: Date.now(), note };
}

/** Ảnh -> WebP (trình duyệt không mã hóa được WebP thì giữ JPEG) */
export function wsToWebp(dataUrl: string, max = 1600): Promise<string> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      const w = c.toDataURL('image/webp', 0.85);
      res(w.startsWith('data:image/webp') ? w : c.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => res(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Workspace = một trang: dàn ý (trái) | trình soạn (giữa) | sidebar dính 4 tab (phải).
 * Nội dung lưu dạng doc JSON (MktContent.doc); sections được suy ra từ doc nên kênh xuất bản, chấm SEO, prompt của v37 dùng tiếp.
 */
export function ContentWorkspace({ api, ro, contentId }: { api: StudioApi; ro: boolean; contentId: string }) {
  const { me, role, users, notify, hubCfg, company: co, contentVersions, setContentVersions, aiQuota, org } = useApp();
  const store = useStudioApi();
  const article = useStudio((s) => s.article);
  const company = useStudio((s) => s.company);
  const { setDoc, setSapo, setSetting, setStep } = useStudioActions();
  const platform = getPlatform(article.platform);
  const settingErrors = platform.validate(article.settings);
  const cliches = hubCfg.ai.cliches?.length ? hubCfg.ai.cliches : HS_CLICHES_DEFAULT;
  const scroller = useRef<HTMLDivElement>(null);
  const zenRef = useRef<HTMLDivElement>(null);
  const [zen, setZen] = useState(false);
  const [view, setView] = useState<'edit' | 'preview' | 'compare'>('edit');
  const [tab, setTab] = useSticky<'seo' | 'human' | 'lsi' | 'history'>('ws.tab', 'seo');
  const [tone, setTone] = useSticky<WsTone>('ws.tone', 'talk');
  const [showWeak, setShowWeak] = useSticky('ws.weak', true);
  const [, setTick] = useState(0);
  const [docJson, setDocJson] = useState<JSONContent>(() => wsEnsureDoc(store.getState().article));
  const [proposal, setProposal] = useState<WsProposal | null>(null);
  const [slash, setSlash] = useState<WsSlash>(null);
  const [imgPanel, setImgPanel] = useState<WsImagePanel>(null);
  const [linkEdit, setLinkEdit] = useState<string | null>(null);
  const [writing, setWriting] = useState<string | null>(null);
  const [compare, setCompare] = useState<[string, string] | null>(null);
  const eligible = ghostEligible(aiQuota, me, role);
  const [ghostOff, setGhostOff] = useState(() => (me ? ghostPrefOff(me.id) : true));
  const [quota, setQuota] = useState<{ used: number; limit: number; blocked?: string } | null>(null);
  const ghostCtl = useRef<{ timer?: ReturnType<typeof setTimeout>; ctl?: AbortController; dead?: string }>({});
  const slashRef = useRef<WsSlash>(null); slashRef.current = slash;
  const slashDismiss = useRef<number>(-1);
  const extensions = useMemo(() => wsExtensions('Gõ / để chèn khối, hoặc viết tiếp…'), []);

  // ---------------- trình soạn ----------------
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUpdate = useRef<(e: Editor) => void>(() => undefined);
  onUpdate.current = (e: Editor) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { const d = e.getJSON(); setDocJson(d); setDoc(d); }, 350);
    scheduleGhost(e);
  };
  const keyRef = useRef<(e: KeyboardEvent) => boolean>(() => false);
  const editor = useEditor({
    extensions,
    content: docJson,
    editable: !ro,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: { attributes: { class: 'ws-prose', spellcheck: 'true', 'aria-label': 'Nội dung bài viết', 'aria-multiline': 'true', role: 'textbox' }, handleKeyDown: (_v, e) => keyRef.current(e) },
    onUpdate: ({ editor: e }) => onUpdate.current(e),
  });
  // Ghi doc lần đầu (bài cũ vừa chuyển từ sections) để lần lưu sau có doc
  useEffect(() => { if (!store.getState().article.doc && !ro) setDoc(docJson); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  // Vẽ lại thanh công cụ nổi / gutter theo vị trí con trỏ (gộp theo khung hình)
  useEffect(() => {
    if (!editor) return;
    let raf = 0;
    const f = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { setTick((t) => t + 1); updateSlash(editor); }); };
    editor.on('transaction', f);
    return () => { cancelAnimationFrame(raf); editor.off('transaction', f); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);
  useEffect(() => () => { if (saveTimer.current) { clearTimeout(saveTimer.current); if (editor && !editor.isDestroyed) setDoc(editor.getJSON()); } ghostCtl.current.ctl?.abort(); }, [editor, setDoc]);

  // Tô viền đoạn cần biên tập
  const human = useMemo(() => wsHumanReport(wsBlocks(docJson), cliches), [docJson, cliches]);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(WS_MARKS, { weak: showWeak ? human.blocks.map((b) => b.id) : [] }).setMeta('addToHistory', false));
  }, [editor, human, showWeak]);

  // ---------------- tọa độ trong khung cuộn ----------------
  const box = () => scroller.current?.getBoundingClientRect() ?? { top: 0, left: 0 };
  // coordsAtPos có thể lỗi khi khung soạn chưa gắn vào trang hoặc vị trí vừa bị xóa: trả 0 thay vì làm hỏng giao diện
  const yOf = (pos: number, bottom = true) => { try { if (!editor) return 0; const c = editor.view.coordsAtPos(Math.min(pos, editor.state.doc.content.size)); return (bottom ? c.bottom : c.top) - box().top + (scroller.current?.scrollTop ?? 0); } catch { return 0; } };
  const xOf = (pos: number) => { try { return editor ? editor.view.coordsAtPos(Math.min(pos, editor.state.doc.content.size)).left - box().left : 0; } catch { return 0; } };

  // ---------------- ghost text ----------------
  const ghostOn = eligible && !ghostOff && !ro && hubCfg.ai.enabled && hubCfg.ai.features.writer;
  useEffect(() => {
    if (!eligible || ro) return;
    let live = true;
    void wsFetch<{ used: number; limit: number; allowed: boolean }>(`/api/ai/complete?tenant=${encodeURIComponent(org.id)}`, { method: 'GET' }).then((r) => {
      if (!live) return;
      if (r.ok) setQuota({ used: r.used, limit: r.limit, blocked: r.allowed ? undefined : 'Tài khoản chưa được bật gợi ý viết tiếp' });
      else if (r.error === 'not_found' || r.error === 'http_404') ghostCtl.current.dead = 'Máy chủ chưa cài route /api/ai/complete';
      else if (r.error === 'quota_not_installed') ghostCtl.current.dead = 'Chưa chạy supabase-v38.sql (hạn mức gợi ý)';
    });
    return () => { live = false; };
  }, [eligible, ro, org.id]);
  const scheduleGhost = (e: Editor) => {
    const g = ghostCtl.current;
    if (g.timer) clearTimeout(g.timer);
    g.ctl?.abort();
    if (!ghostOn || g.dead || (quota && quota.used >= quota.limit)) return;
    g.timer = setTimeout(() => {
      const st = e.state, sel = st.selection, $f = sel.$from;
      if (!sel.empty || !e.isEditable || $f.parent.type.name !== 'paragraph' || $f.parentOffset !== $f.parent.content.size) return;
      const para = $f.parent.textContent;
      if (para.trim().length < 20 || /^\//.test(para) || /[.!?…]\s*$/.test(para) && para.length < 40) return;
      const raw = st.doc.textBetween(Math.max(0, sel.from - 1500), sel.from, '\n');
      const before = hubCfg.ai.maskPii ? maskPii(raw) : raw;
      let heading = '';
      st.doc.forEach((n, pos) => { if (pos < sel.from && n.type.name === 'heading') heading = n.textContent; });
      const docAt = st.doc;
      const ctl = new AbortController(); g.ctl = ctl;
      const a = store.getState().article;
      void wsFetch<{ text: string; used: number; limit: number }>('/api/ai/complete', { method: 'POST', signal: ctl.signal, body: { tenant: org.id, title: a.title, heading, before, keyword: stStr(a.settings.focusKeyword) } }).then((r) => {
        if (!r.ok) {
          if (r.error === 'quota_exceeded') { setQuota((q) => ({ used: q?.limit ?? 0, limit: q?.limit ?? 0 })); notify('Đã dùng hết lượt gợi ý viết tiếp hôm nay', 'orange'); }
          else if (r.error === 'not_allowed' || r.error === 'ghost_disabled') g.dead = 'Tài khoản chưa được bật gợi ý viết tiếp';
          else if (r.error === 'quota_not_installed') g.dead = 'Chưa chạy supabase-v38.sql (hạn mức gợi ý)';
          else if (r.error === 'not_found' || r.error === 'http_404' || r.error === 'ai_not_configured') g.dead = r.error === 'ai_not_configured' ? 'Máy chủ chưa có khóa AI' : 'Máy chủ chưa cài route /api/ai/complete';
          return;
        }
        setQuota({ used: r.used, limit: r.limit });
        if (e.isDestroyed || e.state.doc !== docAt || !r.text.trim()) return;
        const text = (/\s$/.test(para) || /^[\s,.;:!?…)]/.test(r.text) ? '' : ' ') + r.text.replace(/\s+/g, ' ').trim();
        e.view.dispatch(e.state.tr.setMeta(WS_GHOST, { text, pos: e.state.selection.from }));
      });
    }, 600);
  };

  // ---------------- gõ "/" ----------------
  const slashItems = useMemo<WsSlashItem[]>(() => [
    { id: 'h2', label: 'Tiêu đề H2', hint: 'Mục lớn', keys: 'h2 tieu de muc', run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run() },
    { id: 'h3', label: 'Tiêu đề H3', hint: 'Mục con', keys: 'h3 tieu de con', run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run() },
    { id: 'p', label: 'Đoạn văn', hint: 'Chữ thường', keys: 'doan van p text', run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run() },
    { id: 'ul', label: 'Danh sách', hint: 'Gạch đầu dòng', keys: 'danh sach gach dau dong list', run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
    { id: 'ol', label: 'Danh sách số', hint: '1, 2, 3', keys: 'danh sach so thu tu buoc', run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
    { id: 'quote', label: 'Trích dẫn', hint: 'Nhấn mạnh ý', keys: 'trich dan quote', run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
    { id: 'img', label: 'Ảnh chuẩn SEO', hint: 'Tải lên hoặc AI tạo; alt, chú thích, logo', keys: 'anh hinh image', run: (e, r) => { e.chain().focus().deleteRange(r).run(); openImage(e); } },
    { id: 'cta', label: 'Lời kêu gọi liên hệ', hint: 'Hotline / Zalo', keys: 'cta lien he goi hotline zalo', run: (e, r) => e.chain().focus().deleteRange(r).insertContent({ type: 'paragraph', content: [{ type: 'text', text: `👉 Liên hệ ${co.shortName || co.appName}${co.phone ? ` · ${co.phone}` : ''}${co.website ? ` · ${co.website}` : ''} để nhận tư vấn và báo giá.`, marks: [{ type: 'bold' }] }] }).run() },
    { id: 'hr', label: 'Đường kẻ', hint: 'Ngắt phần', keys: 'duong ke hr', run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
  ], [co]);
  const slashList = slash ? slashItems.filter((i) => !slash.query || stFold(`${i.label} ${i.keys}`).includes(stFold(slash.query))) : [];
  const updateSlash = (e: Editor) => {
    const st = e.state, sel = st.selection, $f = sel.$from;
    const t = $f.parent.type.name === 'paragraph' && sel.empty ? $f.parent.textContent : '';
    const m = t.match(/^\/([^\s/]{0,24})$/);
    if (!m || $f.parentOffset !== t.length || ro) { if (slashRef.current) setSlash(null); return; }
    const start = $f.start();
    if (slashDismiss.current === start) return;
    const prev = slashRef.current;
    setSlash({ from: start, to: $f.end(), query: m[1], top: yOf(sel.from) + 6, left: xOf(start), idx: prev && prev.from === start ? prev.idx : 0 });
  };
  const runSlash = (it: WsSlashItem) => { if (!editor || !slash) return; const r = { from: slash.from, to: slash.to }; setSlash(null); it.run(editor, r); };

  // ---------------- phím tắt ----------------
  keyRef.current = (e: KeyboardEvent) => {
    if (!editor) return false;
    const g = WS_GHOST.getState(editor.state);
    if (g && e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      editor.view.dispatch(editor.state.tr.insertText(g.text, g.pos).setMeta(WS_GHOST, null));
      return true;
    }
    if (g && e.key === 'Escape') { editor.view.dispatch(editor.state.tr.setMeta(WS_GHOST, null)); e.preventDefault(); return true; }
    const s = slashRef.current;
    if (s && slashList.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setSlash({ ...s, idx: (s.idx + (e.key === 'ArrowDown' ? 1 : -1) + slashList.length) % slashList.length }); return true; }
      if (e.key === 'Enter') { e.preventDefault(); runSlash(slashList[Math.min(s.idx, slashList.length - 1)]); return true; }
      if (e.key === 'Escape') { e.preventDefault(); slashDismiss.current = s.from; setSlash(null); return true; }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setLinkEdit(editor.isActive('link') ? String(editor.state.selection.$from.marks().find((m) => m.type.name === 'link')?.attrs.href ?? '') : ''); return true; }
    return false;
  };
  // Zen Mode: Esc thoát (khi không có gợi ý / menu nào đang mở)
  useEffect(() => {
    if (!zen) return;
    const f = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !proposal && !imgPanel) { setZen(false); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); } };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [zen, proposal, imgPanel]);

  // ---------------- đề xuất AI dạng so sánh ----------------
  const keywords = [stStr(article.settings.focusKeyword), ...stArr(article.settings.lsiKeywords)].filter(Boolean);
  const toneText = { talk: 'giọng giao tiếp, gần gũi, xưng "bạn"', expert: 'giọng chuyên gia kỹ thuật, chính xác, khách quan', sales: 'giọng bán hàng, nêu lợi ích cụ thể, có lời kêu gọi nhẹ' }[tone];
  const rules = `Giữ nguyên mọi số liệu, đơn vị, mã sản phẩm, tên thương hiệu và các cụm từ khóa: ${keywords.map((k) => `"${k}"`).join(', ') || 'không có'}. Không thêm thông tin, số liệu mới. Giữ định dạng: đoạn văn cách nhau 1 dòng trống, danh sách dùng "- " hoặc "1. ", chữ đậm dùng **…**. Chỉ trả văn bản kết quả, không giải thích.`;
  /** Lấy vùng cần sửa: bôi đen trong 1 đoạn => chỉ sửa phần bôi; còn lại => cả các khối có chọn */
  const rangeOf = (e: Editor, blockId?: string): Pick<WsProposal, 'mode' | 'from' | 'to' | 'original'> | null => {
    if (blockId) {
      const b = wsFindBlock(e, blockId);
      return b ? { mode: 'block', from: b.pos, to: b.pos + b.node.nodeSize, original: wsNodeMd(b.node.toJSON() as JSONContent) } : null;
    }
    const sel = e.state.selection;
    if (sel.empty || sel.$from.depth < 1 || sel.$to.depth < 1) return null;
    if (sel.$from.parent === sel.$to.parent && sel.$from.parent.isTextblock && (sel.$from.parentOffset > 0 || sel.$to.parentOffset < sel.$from.parent.content.size)) {
      return { mode: 'inline', from: sel.from, to: sel.to, original: e.state.doc.textBetween(sel.from, sel.to, ' ') };
    }
    const from = sel.$from.before(1), to = sel.$to.after(1);
    const parts: string[] = [];
    e.state.doc.forEach((n, pos) => { if (pos >= from && pos < to) parts.push(wsNodeMd(n.toJSON() as JSONContent)); });
    return { mode: 'block', from, to, original: parts.filter(Boolean).join('\n\n') };
  };
  const propose = async (kind: WsProposal['kind'], label: string, instruction: string, blockId?: string) => {
    if (!editor || ro) return;
    const r = rangeOf(editor, blockId);
    if (!r || !r.original.trim()) { notify('Bôi đen đoạn cần sửa trước', 'orange'); return; }
    const top = yOf(r.to - (r.mode === 'block' ? 1 : 0)) + 8;
    setSlash(null);
    editor.setEditable(false);
    setProposal({ kind, label, ...r, text: null, busy: true, lost: [], top });
    try {
      const st = store.getState();
      const raw = await api.text({ system: `Bạn là biên tập viên nội dung B2B tiếng Việt của ${st.company.name}${st.company.sector ? `, lĩnh vực ${st.company.sector}` : ''}. ${rules}`, prompt: `${instruction}\n\nBài: "${st.article.title}"\n\nVăn bản cần sửa:\n${r.original}`, maxTokens: Math.min(2000, 200 + r.original.length) });
      let text = wsCleanAi(raw);
      if (r.mode === 'inline') text = text.replace(/\s*\n+\s*/g, ' ');
      setProposal((p) => (p ? { ...p, text, busy: false, lost: wsLost(r.original, text, keywords) } : p));
    } catch (e) {
      setProposal((p) => (p ? { ...p, busy: false, error: e instanceof Error ? e.message : 'AI chưa trả lời được' } : p));
    }
  };
  const humanize = (blockId?: string) => propose('HUMANIZE', `Humanize · ${WS_TONES.find((t) => t.value === tone)?.label}`,
    `Viết lại cho tự nhiên như người viết, ${toneText}: câu dài ngắn xen kẽ, bỏ các cụm sáo (${cliches.slice(0, 12).join(', ')}), dùng từ cụ thể, có thể thêm một câu hỏi hoặc câu ngắn nhấn mạnh. Độ dài tương đương bản gốc.`, blockId);
  const rewrite = (how: 'short' | 'clear' | 'persuade') => propose('REWRITE', { short: 'Ngắn hơn', clear: 'Rõ hơn', persuade: 'Thuyết phục hơn' }[how],
    { short: 'Viết lại ngắn gọn hơn khoảng 30–40%, giữ ý chính.', clear: 'Viết lại rõ ràng, dễ hiểu hơn cho người đọc kỹ thuật: câu ngắn, chủ ngữ rõ, bỏ từ thừa.', persuade: `Viết lại thuyết phục hơn: nêu lợi ích cụ thể cho khách hàng, ${toneText}.` }[how]);
  const insertLsi = (kw: string, blockId?: string) => propose('LSI', `Chèn "${kw}"`, `Viết lại sao cho chứa cụm từ "${kw}" đúng một lần, tự nhiên, đúng ngữ cảnh. Giữ phần còn lại gần như nguyên văn.`, blockId);
  const closeProposal = () => { if (editor && !editor.isDestroyed) editor.setEditable(!ro); setProposal(null); };
  const acceptProposal = () => {
    if (!editor || !proposal?.text) return;
    editor.setEditable(!ro);
    const r = { from: proposal.from, to: proposal.to };
    if (proposal.mode === 'inline') editor.chain().focus().insertContentAt(r, proposal.text).run();
    else editor.chain().focus().insertContentAt(r, wsMdToNodes(proposal.text)).run();
    const kind = proposal.kind;
    setProposal(null);
    if (kind === 'HUMANIZE') setTimeout(() => snapshot('HUMANIZE'), 400);
  };

  // ---------------- AI viết mục trống ----------------
  const writeSection = async (headingId: string) => {
    if (!editor) return false;
    const st = store.getState();
    const p = getPlatform(st.article.platform);
    const text = await api.text({ system: `Bạn là biên tập viên nội dung B2B của ${st.company.name}${st.company.sector ? `, lĩnh vực ${st.company.sector}` : ''}. Chỉ trả nội dung mục, không lặp tiêu đề. ${rules}`, prompt: stSectionPrompt(p, st.article, headingId, st.company), kind: 'section', article: st.article, sectionId: headingId });
    const r = wsSectionRange(editor, headingId);
    if (!r || editor.isDestroyed) return false;
    const nodes = wsMdToNodes(wsCleanAi(text));
    if (r.empty) editor.chain().insertContentAt({ from: r.from, to: r.to }, nodes.length ? nodes : [{ type: 'paragraph' }]).run();
    else editor.chain().insertContentAt(r.to, nodes).run();
    return true;
  };
  const writeAll = async (ids: string[]) => {
    let n = 0;
    for (const id of ids) {
      setWriting(id);
      try { if (await writeSection(id)) n++; } catch (e) { notify(e instanceof Error ? e.message : 'AI chưa viết được', 'orange'); break; }
    }
    setWriting(null);
    if (n) setTimeout(() => snapshot('AI_DRAFT', `${n} mục`), 500);
  };

  // ---------------- ảnh ----------------
  const openImage = (e: Editor) => {
    const $f = e.state.selection.$from;
    let heading = '';
    e.state.doc.forEach((n, pos) => { if (pos < $f.pos && n.type.name === 'heading') heading = n.textContent; });
    const from = $f.depth > 0 ? $f.before(1) : $f.pos, to = $f.depth > 0 ? $f.after(1) : $f.pos;
    const ctx = e.state.doc.textBetween(Math.max(0, from - 600), Math.min(e.state.doc.content.size, to + 400), ' ');
    setImgPanel({ from, to, top: yOf($f.pos) + 6, heading, context: ctx });
  };

  // ---------------- lịch sử ----------------
  const versions = useMemo(() => contentVersions.filter((v) => v.contentId === contentId).sort((a, b) => b.at - a.at), [contentVersions, contentId]);
  const snapshot = (kind: ContentVersionKind, note?: string) => {
    if (!editor || ro) return;
    const d = editor.getJSON();
    setDoc(d); setDocJson(d);
    const v = wsMakeVersion({ ...store.getState().article, doc: d }, store.getState().company, contentId, kind, me?.name ?? '', cliches, note);
    if (v) setContentVersions((p) => wsPushVersion(p, v)); else notify('Nhập tiêu đề trước khi lưu mốc', 'orange');
  };
  const restore = (v: ContentVersion) => {
    if (!editor || ro) return;
    snapshot('RESTORE', `trước khi khôi phục mốc ${new Date(v.at).toLocaleString('vi-VN')}`);
    editor.commands.setContent(v.doc);
    const d = editor.getJSON(); setDoc(d); setDocJson(d);
    setView('edit');
    notify('Đã khôi phục mốc, có thể Hoàn tác bằng Ctrl+Z', 'teal');
  };

  // ---------------- vị trí thanh công cụ nổi / gutter ----------------
  const sel = editor?.state.selection;
  const bubble = editor && sel && !sel.empty && editor.isEditable && !proposal && view === 'edit' && !(editor.isActive('image'))
    ? { top: yOf(sel.from, false) - 46, left: Math.max(0, Math.min(xOf(sel.from), (scroller.current?.clientWidth ?? 800) - 560)) } : null;
  const curBlock = (() => {
    if (!editor || !sel || proposal || ro || view !== 'edit' || sel.$from.depth < 1) return null;
    const node = sel.$from.node(1), pos = sel.$from.before(1);
    if (!['paragraph', 'blockquote', 'bulletList', 'orderedList'].includes(node.type.name) || wsWords(node.textContent).length < 15 || !node.attrs.id) return null;
    return { id: String(node.attrs.id), top: yOf(pos + 1, false) };
  })();
  const missingLsi = stArr(article.settings.lsiKeywords).filter((k) => !stHas(wsBlocks(docJson).map((b) => b.text).join('\n'), k));
  const words = wsWords(wsBlocks(docJson).map((b) => b.text).join(' ')).length;
  const emptyIds = (() => { const ids: string[] = []; if (!editor) return ids; editor.state.doc.forEach((n) => { if (n.type.name === 'heading' && n.attrs.id) { const r = wsSectionRange(editor, String(n.attrs.id)); if (r?.empty) ids.push(String(n.attrs.id)); } }); return ids; })();
  const out = view === 'preview' ? platform.render({ ...article, doc: docJson }, company) : null;

  const btnTb = 'rounded px-2 py-1 text-[13px] hover:bg-white/15 disabled:opacity-40';
  const quotaLeft = quota ? Math.max(0, quota.limit - quota.used) : null;

  const center = (
    <div ref={scroller} className={cn('relative min-h-0 overflow-y-auto bg-[rgb(var(--bg))]', zen ? 'h-full' : '')}>
      <style>{WS_CSS}</style>
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-[rgb(var(--line))] bg-[rgb(var(--surface)/0.92)] px-4 py-2 backdrop-blur">
        <div role="tablist" aria-label="Chế độ" className="flex rounded-md border border-[rgb(var(--line))] p-0.5 text-xs">
          {([['edit', 'Soạn'], ['preview', `Bản ${platform.label}`], ...(compare ? [['compare', 'So sánh mốc']] : [])] as [typeof view, string][]).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} className={cn('rounded px-2.5 py-1', view === k ? 'bg-[rgb(var(--accent))] font-semibold text-[rgb(var(--on-accent))]' : 'text-[rgb(var(--muted))]')}>{l}</button>
          ))}
        </div>
        <span className="text-xs tabular-nums text-[rgb(var(--muted))]">{words.toLocaleString('vi-VN')} từ</span>
        {ghostOn && <span className="text-xs text-[rgb(var(--muted))]" title="Ngừng gõ ở cuối đoạn để AI gợi ý, Tab để nhận, Esc để bỏ">✦ Gợi ý viết tiếp{quotaLeft !== null ? ` · còn ${quotaLeft}` : ''}</span>}
        <span className="flex-1" />
        {out && <button type="button" className={cn(btnGhost, btnSm)} onClick={() => { void navigator.clipboard?.writeText(out.body).then(() => notify(out.format === 'html' ? 'Đã sao chép HTML' : 'Đã sao chép bài', 'teal'), () => notify('Trình duyệt chặn sao chép', 'orange')); }}><Copy className="h-3.5 w-3.5" aria-hidden />{out.format === 'html' ? 'Sao chép HTML' : 'Sao chép bài'}</button>}
        {!ro && view === 'edit' && <button type="button" className={cn(btnGhost, btnSm)} onClick={() => snapshot('MANUAL')}>Lưu mốc</button>}
        <button type="button" className={cn(btnGhost, btnSm)} aria-pressed={zen} onClick={() => setZen((z) => !z)} title="Zen Mode: chỉ còn trang viết, Esc để thoát">{zen ? 'Thoát Zen' : 'Zen'}</button>
        {zen && <button type="button" className={cn(btnGhost, btnSm)} onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void zenRef.current?.requestFullscreen?.().catch(() => undefined); }}>Toàn màn hình</button>}
      </div>

      {settingErrors.length > 0 && !ro && (
        <div className="mx-4 mt-3 flex flex-wrap items-center gap-2 rounded-md bg-[rgb(var(--accent)/0.12)] px-3 py-2 text-sm" role="status">
          <span>Thiếu thông số {platform.label}: <b>{settingErrors.join(', ')}</b>. Nội dung vẫn sửa được; điểm SEO và bản xuất bản cần các thông số này.</span>
          <button type="button" className={cn(btnGhost, btnSm, 'ml-auto')} onClick={() => setStep(1)}>Mở Cài đặt</button>
        </div>
      )}
      {view === 'preview' && out && (
        <article className="mx-auto my-6 max-w-[760px] rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-6">
          {out.meta?.title && <p className="mb-3 text-xs text-[rgb(var(--muted))]">Meta: <b>{out.meta.title}</b> · {out.meta.description}</p>}
          {out.format === 'html'
            ? <div className="ws-prose" style={{ paddingBottom: 0 }} dangerouslySetInnerHTML={{ __html: out.body }} />
            : <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-relaxed">{out.body}</pre>}
        </article>
      )}
      {view === 'compare' && compare && <WsCompare a={versions.find((v) => v.id === compare[0])} b={versions.find((v) => v.id === compare[1])} onClose={() => { setCompare(null); setView('edit'); }} />}

      <div className={cn('mx-auto px-6 pt-6', zen ? 'max-w-[720px]' : 'max-w-[780px]', view === 'edit' ? '' : 'hidden')}>
        <h1 className="font-display text-[28px] font-bold leading-tight">{article.title || 'Chưa có tiêu đề'}</h1>
        <label className="mt-3 block">
          <span className="mb-1 flex items-baseline justify-between text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">{platform.structure.sapoLabel}{platform.structure.sapoMax && <span className={cn('tabular-nums', article.sapo.length > platform.structure.sapoMax && 'text-[rgb(var(--danger-fg))]')}>{article.sapo.length}/{platform.structure.sapoMax}</span>}</span>
          <textarea rows={2} value={article.sapo} readOnly={ro} onChange={(e) => setSapo(e.target.value)} className="w-full resize-y rounded-md border border-transparent bg-transparent text-[16px] font-medium italic leading-relaxed text-[rgb(var(--fg2))] outline-none focus:border-[rgb(var(--line))]" />
        </label>
        {editor ? <EditorContent editor={editor} /> : <p className="py-10 text-sm text-[rgb(var(--muted))]">Đang mở trình soạn…</p>}
      </div>

      {view === 'edit' && bubble && editor && (
        <div className="absolute z-30 flex flex-wrap items-center gap-0.5 rounded-lg bg-[#111827] p-1 text-white shadow-xl" style={{ top: Math.max(4, bubble.top), left: bubble.left + 16 }} onMouseDown={(e) => e.preventDefault()} role="toolbar" aria-label="Định dạng đoạn đã chọn">
          <button type="button" className={cn(btnTb, editor.isActive('bold') && 'bg-white/20')} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Đậm"><b>B</b></button>
          <button type="button" className={cn(btnTb, editor.isActive('italic') && 'bg-white/20')} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Nghiêng"><i>I</i></button>
          <button type="button" className={cn(btnTb, editor.isActive('link') && 'bg-white/20')} onClick={() => setLinkEdit(String(editor.state.selection.$from.marks().find((m) => m.type.name === 'link')?.attrs.href ?? ''))} aria-label="Liên kết (Ctrl+K)">🔗</button>
          <button type="button" className={cn(btnTb, editor.isActive('heading', { level: 2 }) && 'bg-white/20')} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
          <button type="button" className={cn(btnTb, editor.isActive('heading', { level: 3 }) && 'bg-white/20')} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
          <span className="mx-1 h-4 w-px bg-white/25" aria-hidden />
          <WsMenu label="✦ Viết lại" items={[{ label: 'Ngắn hơn', run: () => void rewrite('short') }, { label: 'Rõ hơn', run: () => void rewrite('clear') }, { label: 'Thuyết phục hơn', run: () => void rewrite('persuade') }]} />
          <button type="button" className={cn(btnTb, 'text-[#fdba74]')} onClick={() => void humanize()}>✦ Humanize</button>
          {keywords.length > 0 && <WsMenu label="✦ Chèn LSI" items={[...missingLsi, ...keywords.filter((k) => !missingLsi.includes(k))].slice(0, 8).map((k) => ({ label: `${missingLsi.includes(k) ? '○' : '✓'} ${k}`, run: () => void insertLsi(k) }))} />}
        </div>
      )}
      {view === 'edit' && linkEdit !== null && editor && (
        <form className="absolute z-40 flex gap-2 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-2 shadow-xl" style={{ top: (sel ? yOf(sel.to) : 80) + 8, left: 24 }}
          onSubmit={(e) => { e.preventDefault(); const h = linkEdit.trim(); const c = editor.chain().focus().extendMarkRange('link'); if (h) c.setLink({ href: /^(https?:|mailto:|tel:|\/)/i.test(h) ? h : `https://${h}` }).run(); else c.unsetLink().run(); setLinkEdit(null); }}>
          <input autoFocus className={cn(inputCls, 'h-8 w-72 py-0 text-sm')} value={linkEdit} onChange={(e) => setLinkEdit(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setLinkEdit(null); } }} placeholder="https://… (để trống = bỏ liên kết)" aria-label="Địa chỉ liên kết" />
          <button className={cn(btnPrimary, btnSm)}>Gắn</button>
        </form>
      )}
      {view === 'edit' && curBlock && !bubble && (
        <button type="button" className="absolute z-20 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-1.5 py-0.5 text-[11px] text-[rgb(var(--accent-fg))] opacity-70 shadow-sm hover:opacity-100" style={{ top: curBlock.top, left: 4 }} onMouseDown={(e) => e.preventDefault()} onClick={() => void humanize(curBlock.id)} title="Humanize đoạn này">✦</button>
      )}
      {view === 'edit' && slash && slashList.length > 0 && (
        <ul role="listbox" aria-label="Chèn khối" className="absolute z-30 w-72 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-1 shadow-xl" style={{ top: slash.top, left: Math.max(8, slash.left) }} onMouseDown={(e) => e.preventDefault()}>
          <li className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--faint))]">Chèn khối</li>
          {slashList.map((it, i) => (
            <li key={it.id} role="option" aria-selected={i === slash.idx}>
              <button type="button" className={cn('flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm', i === slash.idx ? 'bg-[rgb(var(--ink)/0.07)]' : '')} onClick={() => runSlash(it)} onMouseEnter={() => setSlash({ ...slash, idx: i })}>
                <b className="font-medium">{it.label}</b><span className="truncate text-xs text-[rgb(var(--muted))]">{it.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {view === 'edit' && proposal && (
        <WsProposalCard p={proposal} onAccept={acceptProposal} onClose={closeProposal} />
      )}
      {view === 'edit' && imgPanel && editor && (
        <WsImageCard panel={imgPanel} api={api} article={article} company={company} logo={co.logo} onClose={() => setImgPanel(null)}
          onInsert={(attrs) => { editor.setEditable(!ro); editor.chain().focus().insertContentAt({ from: imgPanel.from, to: imgPanel.to }, [{ type: 'image', attrs }, { type: 'paragraph' }]).run(); setImgPanel(null); }} />
      )}
    </div>
  );

  return (
    <div ref={zenRef} className={zen ? 'fixed inset-0 z-[60] grid grid-cols-1 bg-[rgb(var(--bg))]' : 'grid h-[calc(100vh-11rem)] min-h-[560px] grid-cols-1 overflow-hidden rounded-xl border border-[rgb(var(--line))] lg:grid-cols-[230px_1fr] xl:grid-cols-[230px_1fr_340px]'}>
      <nav aria-label="Dàn ý" className={cn('hidden min-h-0 flex-col border-r border-[rgb(var(--line))] bg-[rgb(var(--surface))]', !zen && 'lg:flex')}>
        <p className="px-3 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">Dàn ý</p>
        <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2">
          {(docJson.content ?? []).filter((n) => n.type === 'heading').map((n) => {
            const id = String(n.attrs?.id ?? '');
            const empty = emptyIds.includes(id);
            return (
              <li key={id || wsText(n)} className={cn('group flex items-center gap-1 rounded-md px-2 py-1 text-[13px] hover:bg-[rgb(var(--ink)/0.05)]', n.attrs?.level === 3 && 'pl-5 text-[rgb(var(--muted))]')}>
                <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => { const b = editor && wsFindBlock(editor, id); if (b && editor) { editor.chain().focus().setTextSelection(b.pos + 1).run(); (editor.view.nodeDOM(b.pos) as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }}>{wsText(n) || '(chưa đặt tên)'}</button>
                {empty && !ro && <button type="button" disabled={!!writing} onClick={() => void writeAll([id])} className="shrink-0 text-[11px] text-[rgb(var(--accent-fg))] disabled:opacity-40" title="AI viết mục này">{writing === id ? '…' : '✦ Viết'}</button>}
              </li>
            );
          })}
        </ol>
        <div className="space-y-2 border-t border-[rgb(var(--line))] p-3 text-xs">
          {!ro && emptyIds.length > 0 && <button type="button" className={cn(btnGhost, btnSm, 'w-full')} disabled={!!writing} onClick={() => void writeAll(emptyIds)}><Sparkles className="h-3.5 w-3.5" aria-hidden />{writing ? 'AI đang viết…' : `AI viết ${emptyIds.length} mục trống`}</button>}
          {eligible && !ro && (
            <div className="space-y-1.5">
              <label className="flex items-center justify-between gap-2"><span className="font-medium">Gợi ý viết tiếp</span><Switch on={!ghostOff} onChange={(v) => { setGhostOff(!v); try { if (me) localStorage.setItem(GHOST_PREF(me.id), v ? '0' : '1'); } catch { /* bỏ qua */ } }} label="Bật gợi ý viết tiếp" /></label>
              {quota && <><div className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--sunken))]"><div className="h-full bg-[rgb(var(--accent))]" style={{ width: `${Math.min(100, (quota.used / Math.max(1, quota.limit)) * 100)}%` }} /></div><p className="text-[rgb(var(--muted))]">{quota.used}/{quota.limit} lượt hôm nay</p></>}
              {(ghostCtl.current.dead || quota?.blocked) && <p className="text-[rgb(var(--muted))]">{ghostCtl.current.dead || quota?.blocked}</p>}
            </div>
          )}
          <p className="text-[rgb(var(--faint))]">Gõ <kbd className="rounded border border-[rgb(var(--line))] px-1">/</kbd> để chèn khối · bôi đen để định dạng, AI viết lại</p>
        </div>
      </nav>
      {center}
      <aside aria-label="Công cụ biên tập" className={cn('hidden min-h-0 flex-col border-l border-[rgb(var(--line))] bg-[rgb(var(--bg))]', !zen && 'xl:flex')}>
        <div role="tablist" className="flex border-b border-[rgb(var(--line))] bg-[rgb(var(--surface))] text-xs">
          {([['seo', 'SEO'], ['human', `Tự nhiên${human.scored ? ` ${human.score}` : ''}`], ['lsi', 'LSI'], ['history', `Lịch sử${versions.length ? ` ${versions.length}` : ''}`]] as [typeof tab, string][]).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('flex-1 px-2 py-2.5', tab === k ? 'border-b-2 border-[rgb(var(--accent))] font-semibold text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--muted))]')}>{l}</button>
          ))}
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {tab === 'seo' && <><SeoSidebar /><WsImageList editor={editor} doc={docJson} ro={ro} keyword={stStr(article.settings.focusKeyword)} onAdd={() => editor && openImage(editor)} /></>}
          {tab === 'human' && (
            <WsHumanTab report={human} tone={tone} onTone={setTone} showWeak={showWeak} onShowWeak={setShowWeak} ro={ro}
              onGo={(id) => { const b = editor && wsFindBlock(editor, id); if (b && editor) { editor.commands.setTextSelection(b.pos + 1); (editor.view.nodeDOM(b.pos) as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }}
              onHumanize={(id) => void humanize(id)} />
          )}
          {tab === 'lsi' && (
            <WsLsiTab blocks={wsBlocks(docJson)} focus={stStr(article.settings.focusKeyword)} lsi={stArr(article.settings.lsiKeywords)} ro={ro}
              onAdd={(k) => setSetting('lsiKeywords', [...stArr(article.settings.lsiKeywords), k])}
              onRemove={(k) => setSetting('lsiKeywords', stArr(article.settings.lsiKeywords).filter((x) => x !== k))}
              onHighlight={(ids) => { if (!editor) return; editor.view.dispatch(editor.state.tr.setMeta(WS_MARKS, { hit: ids }).setMeta('addToHistory', false)); const b = ids[0] ? wsFindBlock(editor, ids[0]) : null; if (b) (editor.view.nodeDOM(b.pos) as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
              onInsert={(k, id) => void insertLsi(k, id)} />
          )}
          {tab === 'history' && (
            <WsHistoryTab versions={versions} users={users} ro={ro} onSave={() => snapshot('MANUAL')} onRestore={restore}
              onCompare={(a, b) => { setCompare([a, b]); setView('compare'); }} />
          )}
        </div>
      </aside>
    </div>
  );
}

/** Nút mở danh sách lệnh nhỏ trên thanh công cụ nổi */
export function WsMenu({ label, items }: { label: string; items: { label: string; run: () => void }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button type="button" className="rounded px-2 py-1 text-[13px] text-[#fdba74] hover:bg-white/15" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{label} ▾</button>
      {open && (
        <ul className="absolute left-0 top-full z-40 mt-1 min-w-[180px] rounded-md bg-[#111827] p-1 shadow-xl">
          {items.map((it) => <li key={it.label}><button type="button" className="w-full rounded px-2 py-1.5 text-left text-[13px] hover:bg-white/15" onClick={() => { setOpen(false); it.run(); }}>{it.label}</button></li>)}
        </ul>
      )}
    </span>
  );
}

/** Đề xuất của AI: chữ bị xóa gạch đỏ, chữ thêm xanh; cảnh báo số / mã / từ khóa bị mất; Nhận / Bỏ */
export function WsProposalCard({ p, onAccept, onClose }: { p: WsProposal; onAccept: () => void; onClose: () => void }) {
  const diff = useMemo(() => (p.text ? wsDiff(p.original, p.text) : []), [p.original, p.text]);
  return (
    <div className="absolute inset-x-6 z-30 mx-auto max-w-[760px] rounded-xl border border-[rgb(var(--accent)/0.5)] bg-[rgb(var(--surface))] p-4 shadow-2xl" style={{ top: p.top }} role="dialog" aria-label={`Đề xuất AI: ${p.label}`}>
      <div className="mb-2 flex items-center gap-2 text-sm"><Sparkles className="h-4 w-4 text-[rgb(var(--accent))]" aria-hidden /><b>{p.label}</b><span className="text-xs text-[rgb(var(--muted))]">{p.mode === 'inline' ? 'đoạn đã chọn' : 'cả khối'}</span></div>
      {p.busy && <p className="py-3 text-sm text-[rgb(var(--muted))]">AI đang viết đề xuất…</p>}
      {p.error && <p className="py-2 text-sm text-[rgb(var(--danger-fg))]" role="alert">{p.error}</p>}
      {p.text && <div className="ws-diff max-h-[320px] overflow-y-auto whitespace-pre-wrap rounded-md bg-[rgb(var(--sunken))] p-3 text-[15px] leading-relaxed">{diff.map((d, i) => (d.t === 'eq' ? <span key={i}>{d.s}</span> : d.t === 'del' ? <del key={i}>{d.s}</del> : <ins key={i}>{d.s}</ins>))}</div>}
      {p.lost.length > 0 && <p className="mt-2 rounded-md bg-[rgb(var(--danger)/0.1)] px-3 py-2 text-xs text-[rgb(var(--danger-fg))]" role="alert">Bản mới thiếu: <b>{p.lost.slice(0, 8).join(', ')}</b>. Kiểm tra số liệu / mã / từ khóa trước khi nhận.</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className={cn(btnGhost, btnSm)} onClick={onClose}>Bỏ</button>
        <button type="button" className={cn(btnPrimary, btnSm)} disabled={!p.text} onClick={onAccept}>Nhận đề xuất</button>
      </div>
    </div>
  );
}

/** Chèn ảnh: tải lên hoặc AI tạo; tên file theo tiêu đề mục, alt ≤ 125 ký tự, chú thích, đóng logo, chuyển WebP */
export function WsImageCard({ panel, api, article, company, logo: logo0, onClose, onInsert }: { panel: NonNullable<WsImagePanel>; api: StudioApi; article: StArticle; company: StCompany; logo?: string; onClose: () => void; onInsert: (attrs: Record<string, string>) => void }) {
  const { skus, mktImages } = useApp();
  const [lib, setLib] = useState(false);
  const kw = stStr(article.settings.focusKeyword);
  const stampMode = vImg(article.settings, 'imgStamp', article.platform);
  const logo = stampMode === 'name' ? undefined : logo0;
  const refImg = stArr(article.settings[vKey('imgRef')]).map((id) => skus.find((x) => x.sku === id)?.image).find((u) => u?.startsWith('data:'));
  const extra = vText(article.settings, article.platform, 'image');
  const n = wsImages(article.doc).length + 1;
  const [src, setSrc] = useState('');
  const [prompt, setPrompt] = useState(`Ảnh minh họa cho "${panel.heading || article.title}"${extra ? `, ${extra}` : ', bối cảnh công trình thực tế tại Việt Nam, ảnh chụp chân thực'}`);
  const [alt, setAlt] = useState(stClip([panel.heading || article.title, kw && !stHas(panel.heading, kw) ? kw : ''].filter(Boolean).join(' – '), 125));
  const [caption, setCaption] = useState('');
  const [fileName, setFileName] = useState(`${slugify(panel.heading || article.title) || 'anh'}-${n}.webp`);
  const [stamp, setStamp] = useState(stampMode !== 'nostamp');
  const [busy, setBusy] = useState<'' | 'img' | 'text'>('');
  const [err, setErr] = useState('');
  const finish = async (raw: string) => {
    const marked = stamp ? await applyWatermark(raw, company.name, logo).catch(() => raw) : raw;
    setSrc(await wsToWebp(marked));
  };
  const pick = async (f?: File) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setErr('Chọn ảnh JPG, PNG hoặc WebP');
    setErr(''); setBusy('img');
    try { await finish(await stShrinkImage(f, 1600)); } catch (e) { setErr(e instanceof Error ? e.message : 'Không đọc được ảnh'); } finally { setBusy(''); }
  };
  const gen = async () => {
    setErr(''); setBusy('img');
    try { const brand = vImg(article.settings, 'imgColor', article.platform) !== 'natural'; const r = await api.image({ prompt: brand ? `${prompt}\n${ST_BRAND.palettePrompt}` : prompt, aspect: vAspect(article.settings, article.platform, getPlatform(article.platform).image.aspect), reference: refImg, strength: 0.35, brandPalette: brand }); await finish(r.dataUrl); } catch (e) { setErr(e instanceof Error ? e.message : 'Không tạo được ảnh'); } finally { setBusy(''); }
  };
  const suggest = async () => {
    setErr(''); setBusy('text');
    try {
      const raw = await api.text({ system: 'Chỉ trả JSON hợp lệ.', prompt: `Viết alt text (≤ 125 ký tự, mô tả đúng nội dung ảnh, tự nhiên chứa "${kw || panel.heading}") và chú thích ảnh 1 câu (≤ 140 ký tự) cho ảnh trong mục "${panel.heading}" của bài "${article.title}". Đoạn văn quanh ảnh: ${panel.context.slice(0, 900)}\nTrả JSON {"alt":"...","caption":"..."}`, maxTokens: 600 });
      const j = parseAiJson<{ alt?: string; caption?: string }>(raw);
      if (!j) throw new Error('AI trả sai định dạng');
      if (j.alt) setAlt(stClip(j.alt, 125));
      if (j.caption) setCaption(stClip(j.caption, 160));
    } catch (e) {
      setCaption(stClip(panel.context.split(/(?<=[.!?])\s/)[0] ?? '', 140));
      setErr(e instanceof Error ? `${e.message}. Đã điền chú thích từ đoạn văn quanh ảnh.` : 'AI chưa trả lời');
    } finally { setBusy(''); }
  };
  return (
    <div className="absolute inset-x-6 z-30 mx-auto max-w-[760px] rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4 shadow-2xl" style={{ top: panel.top }} role="dialog" aria-label="Chèn ảnh chuẩn SEO">
      <div className="mb-3 flex items-center justify-between"><b className="text-sm">Ảnh chuẩn SEO{panel.heading ? ` · ${panel.heading}` : ''}</b><button type="button" onClick={onClose} aria-label="Đóng" className="rounded p-1 hover:bg-[rgb(var(--ink)/0.06)]"><X className="h-4 w-4" /></button></div>
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          <label className="flex aspect-[3/2] cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-[rgb(var(--line))] bg-[rgb(var(--sunken))] text-center text-xs text-[rgb(var(--muted))] hover:border-[rgb(var(--accent))]"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files?.[0]); }}>
            {src ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : <span className="px-3">{busy === 'img' ? 'Đang xử lý ảnh…' : 'Kéo thả / bấm để tải ảnh'}</span>}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={stamp} onChange={(e) => setStamp(e.target.checked)} />Đóng {logo ? 'logo' : 'tên'} {company.name}</label>
          {mktImages.length > 0 && <button type="button" className="text-xs font-medium text-[rgb(var(--secondary-fg))] hover:underline" aria-expanded={lib} onClick={() => setLib((v) => !v)}>{lib ? 'Ẩn thư viện ảnh' : `Chọn từ thư viện ảnh (${mktImages.length})`}</button>}
          {lib && (
            <div className="grid max-h-40 grid-cols-3 gap-1.5 overflow-y-auto" role="listbox" aria-label="Thư viện ảnh">
              {mktImages.map((x) => <button key={x.id} type="button" role="option" aria-selected={src === x.url} title={x.alt} className={cn('overflow-hidden rounded border', src === x.url ? 'border-[rgb(var(--accent))]' : 'border-[rgb(var(--line))]')} onClick={() => { setSrc(x.url); if (x.alt) setAlt(stClip(x.alt, 125)); if (x.caption) setCaption(x.caption); setFileName(x.fileName); setLib(false); }}><img src={x.url} alt={x.alt} className="aspect-square w-full object-cover" /></button>)}
            </div>
          )}
        </div>
        <div className="space-y-2 text-sm">
          <Field label="Hoặc mô tả để AI tạo ảnh"><div className="flex gap-2"><textarea rows={2} className={cn(inputCls, 'text-xs')} value={prompt} onChange={(e) => setPrompt(e.target.value)} /><button type="button" className={cn(btnGhost, btnSm, 'shrink-0 self-start')} disabled={!!busy} onClick={() => void gen()} title={refImg ? 'Bám theo ảnh sản phẩm đã chọn ở Yêu cầu hình ảnh' : undefined}>{busy === 'img' ? '…' : refImg ? 'Tạo theo ảnh SP' : 'Tạo ảnh'}</button></div></Field>
          <Field label={`Alt text (${alt.length}/125)`}><input className={inputCls} value={alt} maxLength={125} onChange={(e) => setAlt(e.target.value)} /></Field>
          <Field label="Chú thích ảnh"><input className={inputCls} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="1 câu mô tả, hiện dưới ảnh" /></Field>
          <Field label="Tên file khi xuất / đăng"><input className={cn(inputCls, 'font-mono text-xs')} value={fileName} onChange={(e) => setFileName(slugify(e.target.value.replace(/\.webp$/i, '')) + '.webp')} /></Field>
        </div>
      </div>
      {err && <p className="mt-2 text-xs text-[rgb(var(--danger-fg))]" role="alert">{err}</p>}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className={cn(btnGhost, btnSm)} disabled={!!busy} onClick={() => void suggest()}><Sparkles className="h-3.5 w-3.5" aria-hidden />{busy === 'text' ? 'AI đang viết…' : 'AI viết alt & chú thích'}</button>
        <button type="button" className={cn(btnPrimary, btnSm)} disabled={!src || !alt.trim() || !!busy} onClick={() => onInsert({ src, alt: alt.trim(), title: caption.trim(), caption: caption.trim(), fileName })}>Chèn ảnh</button>
      </div>
    </div>
  );
}

/** Danh sách ảnh trong bài ở tab SEO: sửa alt / chú thích ngay, báo thiếu alt, alt trùng, alt thiếu từ khóa */
export function WsImageList({ editor, doc, ro, keyword, onAdd }: { editor: Editor | null; doc: JSONContent; ro: boolean; keyword: string; onAdd: () => void }) {
  const imgs = (doc.content ?? []).map((n, i) => ({ n, i })).filter((x) => x.n.type === 'image');
  const alts = imgs.map((x) => String(x.n.attrs?.alt ?? '').trim());
  const setAttr = (id: string, k: 'alt' | 'caption', v: string) => {
    if (!editor) return;
    const b = wsFindBlock(editor, id);
    if (b) editor.view.dispatch(editor.state.tr.setNodeMarkup(b.pos, undefined, { ...b.node.attrs, [k]: v, ...(k === 'caption' ? { title: v } : {}) }));
  };
  return (
    <section className="rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4">
      <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Ảnh trong bài · {imgs.length}</p>{!ro && <button type="button" className="text-xs font-medium text-[rgb(var(--secondary-fg))] hover:underline" onClick={onAdd}>+ Chèn ảnh tại con trỏ</button>}</div>
      {!imgs.length && <p className="text-xs text-[rgb(var(--muted))]">Chưa có ảnh. Gõ / rồi chọn "Ảnh chuẩn SEO".</p>}
      <ul className="space-y-3">
        {imgs.map(({ n }, k) => {
          const a = alts[k];
          const warn = !a ? 'Thiếu alt' : alts.filter((x) => x === a).length > 1 ? 'Alt trùng ảnh khác' : keyword && !stHas(a, keyword) && k === 0 ? 'Ảnh đầu nên có từ khóa chính' : '';
          const id = String(n.attrs?.id ?? '');
          return (
            <li key={id || k} className="flex gap-2">
              <img src={String(n.attrs?.src ?? '')} alt="" className="h-12 w-16 shrink-0 rounded object-cover" />
              <div className="min-w-0 flex-1 space-y-1">
                <input className={cn(inputCls, 'h-7 py-0 text-xs')} defaultValue={a} readOnly={ro} maxLength={125} onBlur={(e) => e.target.value !== a && setAttr(id, 'alt', e.target.value)} aria-label="Alt text" placeholder="Alt text" />
                <input className={cn(inputCls, 'h-7 py-0 text-xs')} defaultValue={String(n.attrs?.caption ?? '')} readOnly={ro} onBlur={(e) => setAttr(id, 'caption', e.target.value)} aria-label="Chú thích" placeholder="Chú thích" />
                {warn && <p className="text-[11px] text-[rgb(var(--accent-fg))]">! {warn}</p>}
                {n.attrs?.fileName && <p className="truncate font-mono text-[10px] text-[rgb(var(--faint))]">{String(n.attrs.fileName)}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function WsHumanTab({ report, tone, onTone, showWeak, onShowWeak, ro, onGo, onHumanize }: { report: HumanReport; tone: WsTone; onTone: (t: WsTone) => void; showWeak: boolean; onShowWeak: (v: boolean) => void; ro: boolean; onGo: (id: string) => void; onHumanize: (id: string) => void }) {
  const color = report.score >= 70 ? 'rgb(var(--success))' : report.score >= 50 ? 'rgb(var(--accent))' : 'rgb(var(--danger))';
  const C = 2 * Math.PI * 34;
  if (!report.scored && !report.metrics.length) return <p className="rounded-xl border border-dashed border-[rgb(var(--line))] p-4 text-sm text-[rgb(var(--muted))]">Viết ít nhất khoảng 40 từ để chấm độ tự nhiên.</p>;
  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4">
        <div className="flex items-center gap-4">
          <svg viewBox="0 0 80 80" className="h-20 w-20 shrink-0" role="img" aria-label={`Human Score ${report.score}/100`}>
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgb(var(--sunken))" strokeWidth="8" />
            <circle cx="40" cy="40" r="34" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(report.score / 100) * C} ${C}`} transform="rotate(-90 40 40)" />
            <text x="40" y="46" textAnchor="middle" fontSize="20" fontWeight="700" fill="rgb(var(--fg))">{report.score}</text>
          </svg>
          <div className="text-sm"><p className="font-semibold">{report.score >= 70 ? 'Đọc tự nhiên' : report.score >= 50 ? 'Khá, nên biên tập thêm' : 'Nghe như văn máy'}</p><p className="text-xs text-[rgb(var(--muted))]">{report.weakPct}% đoạn cần biên tập ({report.blocks.length}/{report.scored})</p></div>
        </div>
        <ul className="mt-3 space-y-2">
          {report.metrics.map((m) => (
            <li key={m.label} title={m.hint}>
              <div className="flex justify-between text-xs"><span>{m.label}</span><span className="tabular-nums text-[rgb(var(--muted))]">{Math.round(m.value * 100)}</span></div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--sunken))]"><div className="h-full rounded-full" style={{ width: `${Math.round(m.value * 100)}%`, background: m.value >= 0.6 ? 'rgb(var(--success))' : m.value >= 0.4 ? 'rgb(var(--accent))' : 'rgb(var(--danger))' }} /></div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-snug text-[rgb(var(--faint))]">Điểm ước lượng để biên tập (độ biến thiên câu, từ vựng, cụm sáo), không phải máy dò AI và không đảm bảo qua công cụ phát hiện nào.</p>
      </section>
      <section className="rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4 text-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs">Giọng<select className={cn(inputBase, 'h-7 py-0 text-xs')} value={tone} onChange={(e) => onTone(e.target.value as WsTone)}>{WS_TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="h-3.5 w-3.5 accent-[rgb(var(--accent))]" checked={showWeak} onChange={(e) => onShowWeak(e.target.checked)} />Tô đoạn yếu</label>
        </div>
        {!report.blocks.length && <p className="text-xs text-[rgb(var(--muted))]">Không có đoạn nào dưới ngưỡng.</p>}
        <ul className="space-y-2">
          {report.blocks.map((b) => (
            <li key={b.id} className="rounded-md border border-[rgb(var(--line))] p-2.5">
              <div className="flex items-center gap-2"><span className="rounded bg-[rgb(var(--accent)/0.14)] px-1.5 text-xs font-semibold tabular-nums text-[rgb(var(--accent-fg))]">{b.score}</span><button type="button" className="min-w-0 flex-1 truncate text-left text-xs font-medium hover:underline" onClick={() => onGo(b.id)}>{b.heading || 'Đoạn mở đầu'} · {b.words} từ</button></div>
              <p className="mt-1 text-xs text-[rgb(var(--muted))]">{b.reasons.join(' · ') || 'Nhịp câu đều'}</p>
              {!ro && <button type="button" className="mt-1.5 text-xs font-medium text-[rgb(var(--accent-fg))] hover:underline" onClick={() => onHumanize(b.id)}>✦ Humanize đoạn này</button>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** LSI real-time: số lần mỗi từ khóa xuất hiện; từ còn thiếu -> tô 1–3 đoạn hợp nhất và gợi ý chèn */
export function WsLsiTab({ blocks, focus, lsi, ro, onAdd, onRemove, onHighlight, onInsert }: { blocks: WsBlock[]; focus: string; lsi: string[]; ro: boolean; onAdd: (k: string) => void; onRemove: (k: string) => void; onHighlight: (ids: string[]) => void; onInsert: (k: string, blockId: string) => void }) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const all = blocks.map((b) => b.text).join('\n');
  const prose = blocks.filter((b) => b.type === 'paragraph' && wsWords(b.text).length >= 12 && b.id);
  const best = (k: string) => {
    const kw = new Set(wsWords(stFold(k)));
    return prose.map((b) => { const w = wsWords(stFold(`${b.heading} ${b.heading} ${b.text}`)); return { b, s: w.filter((x) => kw.has(x)).length / Math.sqrt(w.length + 1) }; })
      .sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.b);
  };
  const rows = [...(focus ? [{ k: focus, main: true }] : []), ...lsi.map((k) => ({ k, main: false }))];
  return (
    <section className="space-y-3 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4 text-sm">
      <p className="text-xs text-[rgb(var(--muted))]">Đếm theo không dấu, cập nhật khi gõ. Bấm từ còn thiếu để xem đoạn nên chèn.</p>
      <ul className="space-y-1.5">
        {rows.map(({ k, main }) => {
          const c = countOf(all, k);
          const cand = open === k ? best(k) : [];
          return (
            <li key={k} className="rounded-md border border-[rgb(var(--line))]">
              <div className="flex items-center gap-2 px-2.5 py-1.5">
                <span className={cn('w-4 text-center font-bold', c ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--danger-fg))]')} aria-hidden>{c ? '✓' : '○'}</span>
                <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => { const nx = open === k ? null : k; setOpen(nx); onHighlight(nx ? best(k).map((b) => b.id) : []); }}>{k}{main && <span className="ml-1 text-[10px] text-[rgb(var(--muted))]">chính</span>}</button>
                <span className="text-xs tabular-nums text-[rgb(var(--muted))]">{c}×</span>
                {!main && !ro && <button type="button" aria-label={`Bỏ ${k}`} className="text-[rgb(var(--faint))] hover:text-[rgb(var(--danger-fg))]" onClick={() => onRemove(k)}>×</button>}
              </div>
              {open === k && (
                <ul className="space-y-1 border-t border-[rgb(var(--line))] px-2.5 py-2">
                  {!cand.length && <li className="text-xs text-[rgb(var(--muted))]">Chưa có đoạn đủ dài để chèn.</li>}
                  {cand.map((b) => (
                    <li key={b.id} className="text-xs"><span className="text-[rgb(var(--muted))]">{b.heading || 'Mở đầu'}:</span> {stClip(b.text, 90)}
                      {!ro && <button type="button" className="ml-1 font-medium text-[rgb(var(--accent-fg))] hover:underline" onClick={() => onInsert(k, b.id)}>✦ Chèn vào đoạn này</button>}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {!ro && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const k = draft.trim(); if (k && !lsi.includes(k) && k !== focus) onAdd(k); setDraft(''); }}>
          <input className={cn(inputCls, 'h-8 py-0 text-xs')} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Thêm từ khóa LSI" aria-label="Thêm từ khóa LSI" />
          <button className={cn(btnGhost, btnSm)}>Thêm</button>
        </form>
      )}
    </section>
  );
}

export function WsHistoryTab({ versions, users, ro, onSave, onRestore, onCompare }: { versions: ContentVersion[]; users: User[]; ro: boolean; onSave: () => void; onRestore: (v: ContentVersion) => void; onCompare: (a: string, b: string) => void }) {
  const [pick, setPick] = useState<string[]>([]);
  const toggle = (id: string) => setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-1), id]));
  void users;
  return (
    <section className="space-y-3 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4 text-sm">
      <div className="flex items-center justify-between gap-2"><p className="text-xs text-[rgb(var(--muted))]">Tự lưu mốc khi AI viết, khi Humanize, khi gửi duyệt. Tối đa {CV_MAX} mốc.</p>{!ro && <button type="button" className={cn(btnGhost, btnSm)} onClick={onSave}>Lưu mốc</button>}</div>
      {!versions.length && <p className="text-xs text-[rgb(var(--muted))]">Chưa có mốc nào.</p>}
      <ul className="space-y-1.5">
        {versions.map((v) => (
          <li key={v.id} className={cn('rounded-md border px-2.5 py-2', pick.includes(v.id) ? 'border-[rgb(var(--accent))]' : 'border-[rgb(var(--line))]')}>
            <div className="flex items-center gap-2">
              <input type="checkbox" className="h-3.5 w-3.5 accent-[rgb(var(--accent))]" checked={pick.includes(v.id)} onChange={() => toggle(v.id)} aria-label="Chọn để so sánh" />
              <Chip tone={CV_KIND[v.kind].tone}>{CV_KIND[v.kind].label}</Chip>
              <span className="text-xs tabular-nums text-[rgb(var(--muted))]">{new Date(v.at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="mt-1 text-xs text-[rgb(var(--muted))]">SEO {v.seoScore} · Tự nhiên {v.humanScore || '—'}{v.by ? ` · ${v.by}` : ''}{v.note ? ` · ${v.note}` : ''}</p>
            {!ro && <button type="button" className="mt-1 text-xs font-medium text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => onRestore(v)}>Khôi phục mốc này</button>}
          </li>
        ))}
      </ul>
      <button type="button" className={cn(btnPrimary, btnSm, 'w-full')} disabled={pick.length !== 2} onClick={() => { const [a, b] = [...pick].sort((x, y) => (versions.find((v) => v.id === x)?.at ?? 0) - (versions.find((v) => v.id === y)?.at ?? 0)); onCompare(a, b); }}>So sánh 2 mốc đã chọn</button>
    </section>
  );
}

/** So sánh 2 mốc theo từng khối (theo id khối): khối thêm, bớt, sửa (so từng từ) */
export function WsCompare({ a, b, onClose }: { a?: ContentVersion; b?: ContentVersion; onClose: () => void }) {
  const rows = useMemo(() => {
    if (!a || !b) return [];
    const A = wsBlocks(a.doc), B = wsBlocks(b.doc);
    const mapA = new Map(A.map((x) => [x.id, x]));
    const seen = new Set<string>();
    const out: { id: string; kind: 'same' | 'add' | 'del' | 'edit'; heading: string; diff: WsDiffPart[] }[] = [];
    for (const x of B) {
      const o = x.id ? mapA.get(x.id) : undefined;
      if (o) { seen.add(o.id); out.push(o.text === x.text ? { id: x.id, kind: 'same', heading: x.heading, diff: [] } : { id: x.id, kind: 'edit', heading: x.heading, diff: wsDiff(o.text, x.text) }); }
      else out.push({ id: x.id || uid('n'), kind: 'add', heading: x.heading, diff: [{ t: 'ins', s: x.text }] });
    }
    for (const o of A) if (o.id && !seen.has(o.id)) out.push({ id: o.id, kind: 'del', heading: o.heading, diff: [{ t: 'del', s: o.text }] });
    return out.filter((r) => r.kind !== 'same');
  }, [a, b]);
  if (!a || !b) return null;
  const t = (v: ContentVersion) => `${CV_KIND[v.kind].label} ${new Date(v.at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
  return (
    <div className="mx-auto my-6 max-w-[780px] space-y-3 px-6">
      <div className="flex flex-wrap items-center gap-2 text-sm"><b>{t(a)}</b><span className="text-[rgb(var(--muted))]">→</span><b>{t(b)}</b>
        <span className="text-xs text-[rgb(var(--muted))]">SEO {a.seoScore} → {b.seoScore} · Tự nhiên {a.humanScore} → {b.humanScore} · {rows.length} khối khác</span>
        <span className="flex-1" /><button type="button" className={cn(btnGhost, btnSm)} onClick={onClose}>Về trình soạn</button></div>
      {!rows.length && <p className="rounded-xl border border-dashed border-[rgb(var(--line))] p-6 text-center text-sm text-[rgb(var(--muted))]">Hai mốc giống nhau.</p>}
      {rows.map((r) => (
        <div key={`${r.kind}-${r.id}`} className="ws-diff rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4 text-[15px] leading-relaxed">
          <p className="mb-1 text-xs text-[rgb(var(--muted))]">{r.heading || 'Mở đầu'} · {{ add: 'thêm mới', del: 'đã xóa', edit: 'đã sửa', same: '' }[r.kind]}</p>
          <p className="whitespace-pre-wrap">{r.diff.map((d, i) => (d.t === 'eq' ? <span key={i}>{d.s}</span> : d.t === 'del' ? <del key={i}>{d.s}</del> : <ins key={i}>{d.s}</ins>))}</p>
        </div>
      ))}
    </div>
  );
}

/** Cài đặt › AI: gợi ý viết tiếp (ai được bật, giới hạn lượt / người / ngày) và danh sách cụm sáo cho Human Score */
export function GhostSettingsPanel() {
  const { aiQuota, setAiQuota, hubCfg, setHubCfg, users, role, canDo, audit } = useApp();
  const g = aiQuota.ghost;
  const canQuota = role === 'BOD';
  const set = (p: Partial<AiQuotaCfg['ghost']>) => { setAiQuota((q) => ({ ...q, ghost: { ...q.ghost, ...p } })); audit('Cài đặt AI', `Gợi ý viết tiếp: ${JSON.stringify(p).slice(0, 160)}`); };
  const [custom, setCustom] = useState(![50, 100].includes(g.dailyLimit));
  const defaults = users.filter((u) => u.active && (u.role === 'BOD' || u.role === 'MKT_LEAD' || u.dept === 'MARKETING'));
  const others = users.filter((u) => u.active && !defaults.includes(u));
  return (
    <Panel title="Gợi ý viết tiếp (ghost text) & độ tự nhiên">
      <div className="space-y-4 text-sm">
        <label className="flex items-center justify-between gap-3"><span><b>Bật gợi ý viết tiếp trong Content Studio</b><span className="block text-xs text-[rgb(var(--muted))]">Ngừng gõ ở cuối đoạn khoảng 0,6 giây: AI gợi ý tối đa ~30 từ, Tab để nhận. Mỗi gợi ý tính 1 lượt; máy chủ đếm và chặn khi vượt.</span></span><Switch on={g.enabled} onChange={(v) => set({ enabled: v })} label="Bật gợi ý viết tiếp" disabled={!canQuota} /></label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[rgb(var(--muted))]">Giới hạn mỗi người / ngày</span>
          {[50, 100].map((n) => <button key={n} type="button" disabled={!canQuota} onClick={() => { setCustom(false); set({ dailyLimit: n }); }} className={cn('rounded-full border px-3 py-1 text-xs', !custom && g.dailyLimit === n ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.12)] font-semibold' : 'border-[rgb(var(--line))]')}>{n} lượt</button>)}
          <button type="button" disabled={!canQuota} onClick={() => setCustom(true)} className={cn('rounded-full border px-3 py-1 text-xs', custom ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.12)] font-semibold' : 'border-[rgb(var(--line))]')}>Số khác</button>
          {custom && <input type="number" min={1} max={1000} disabled={!canQuota} className={cn(inputBase, 'h-8 w-24 py-0')} defaultValue={g.dailyLimit} onBlur={(e) => set({ dailyLimit: Math.max(1, Math.min(1000, Math.round(Number(e.target.value) || 50))) })} aria-label="Số lượt mỗi ngày" />}
        </div>
        <div>
          <p className="text-xs font-medium text-[rgb(var(--muted))]">Mặc định bật cho Giám đốc, Trưởng Marketing và nhân sự phòng Marketing ({defaults.length} người)</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{defaults.map((u) => (
            <label key={u.id} className="flex items-center gap-1.5 rounded-full border border-[rgb(var(--line))] px-2.5 py-1 text-xs"><input type="checkbox" className="h-3.5 w-3.5 accent-[rgb(var(--accent))]" disabled={!canQuota} checked={!g.blockedUsers.includes(u.id)} onChange={(e) => set({ blockedUsers: e.target.checked ? g.blockedUsers.filter((x) => x !== u.id) : [...g.blockedUsers, u.id] })} />{u.name}</label>
          ))}</div>
        </div>
        <div>
          <p className="text-xs font-medium text-[rgb(var(--muted))]">Bật thêm cho người khác</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{others.map((u) => (
            <label key={u.id} className="flex items-center gap-1.5 rounded-full border border-[rgb(var(--line))] px-2.5 py-1 text-xs"><input type="checkbox" className="h-3.5 w-3.5 accent-[rgb(var(--accent))]" disabled={!canQuota} checked={g.extraUsers.includes(u.id)} onChange={(e) => set({ extraUsers: e.target.checked ? [...g.extraUsers, u.id] : g.extraUsers.filter((x) => x !== u.id) })} />{u.name}</label>
          ))}{!others.length && <span className="text-xs text-[rgb(var(--muted))]">Không còn ai</span>}</div>
        </div>
        {!canQuota && <p className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]"><Lock className="h-3.5 w-3.5" aria-hidden />Chỉ Giám đốc đổi được giới hạn và danh sách người dùng (máy chủ cũng chặn).</p>}
        <Field label="Cụm sáo dùng để chấm Human Score (mỗi dòng một cụm; dùng ... cho cặp như “không chỉ ... mà còn”)">
          <textarea className={cn(inputCls, 'min-h-[110px] text-xs')} disabled={!canDo('mkt.manage')} defaultValue={(hubCfg.ai.cliches?.length ? hubCfg.ai.cliches : HS_CLICHES_DEFAULT).join('\n')}
            onBlur={(e) => setHubCfg((c) => ({ ...c, ai: { ...c.ai, cliches: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) } }))} />
        </Field>
      </div>
    </Panel>
  );
}

/** Nhóm + lựa chọn đang dùng được ở kênh này (đã áp ẩn / thêm của doanh nghiệp) */
export function vGroups(cfg: ContentVariantCfg, platform: string | undefined, kind?: VariantKind): VariantGroup[] {
  return VARIANT_GROUPS.filter((g) => (!kind || g.kind === kind) && (!g.channels || !platform || g.channels.includes(platform))).map((g) => ({
    ...g,
    options: [...g.options, ...cfg.custom.filter((c) => c.group === g.id).map((c) => ({ ...c, custom: true }))]
      .filter((o) => (!o.channels || !platform || o.channels.includes(platform)) && !cfg.hidden.includes(`${g.id}:${o.id}`)),
  })).filter((g) => g.options.length > 0);
}

/** Lựa chọn hiệu lực của một nhóm: đã chọn > mặc định doanh nghiệp > mặc định */
export function vPicked(g: VariantGroup, s: StSettings, cfg: ContentVariantCfg): string[] {
  const own = s[vKey(g.id)];
  const ids = new Set(g.options.map((o) => o.id));
  if (Array.isArray(own)) return own.filter((x) => ids.has(x));
  const d = cfg.defaults[g.id];
  if (d) return d.filter((x) => ids.has(x));
  const def = g.options.filter((o) => o.def).map((o) => o.id);
  return g.multi ? def : def.slice(0, 1);
}

/** Ghép các lựa chọn thành chỉ dẫn cho AI */
export function vText(s: StSettings, platform: string | undefined, kind: VariantKind, cfg = ST_VARIANT_CACHE.cfg): string {
  return vGroups(cfg, platform, kind).flatMap((g) => vPicked(g, s, cfg).map((id) => g.options.find((o) => o.id === id)?.prompt ?? '')).filter(Boolean).join(kind === 'image' ? ', ' : '\n- ');
}

/** Số từ mục tiêu theo nhóm Độ dài (0 = không đặt) */
export function vWords(s: StSettings, platform: string | undefined, cfg = ST_VARIANT_CACHE.cfg): number {
  const g = vGroups(cfg, platform, 'text').find((x) => x.id === 'length');
  const id = g ? vPicked(g, s, cfg)[0] : undefined;
  return g?.options.find((o) => o.id === id)?.words ?? 0;
}

/** Chọn dạng bài -> tích sẵn các nhóm được gợi ý (chỉ ghi đè nhóm đó, giữ nhóm khác) */
export function vApplyType(s: StSettings, typeId: string, cfg: ContentVariantCfg): StSettings {
  const t = [...VARIANT_GROUPS[0].options, ...cfg.custom.filter((c) => c.group === 'type')].find((o) => o.id === typeId);
  const next: StSettings = { ...s, [vKey('type')]: [typeId] };
  for (const [g, ids] of Object.entries(t?.implies ?? {})) next[vKey(g)] = ids;
  return next;
}

/** Từ khóa trùng với bài / nhiệm vụ khác (tranh thứ hạng với nhau) */
export function kwConflicts(kw: string, self: { contentId?: string; taskId?: string }, contents: MktContent[], tasks: MktTask[]): { title: string; where: string }[] {
  const k = stFold(kw).trim();
  if (k.length < 4) return [];
  const same = (x: unknown) => { const o = stFold(stStr(x)).trim(); return o.length >= 4 && (o === k || (o.includes(k) && k.split(' ').length >= 2) || (k.includes(o) && o.split(' ').length >= 2)); };
  const out: { title: string; where: string }[] = [];
  for (const c of contents) if (c.id !== self.contentId && same(c.settings?.focusKeyword)) out.push({ title: c.title, where: `Content Studio · ${CONTENT_STATUS[c.status].label}` });
  for (const t of tasks) if (t.id !== self.taskId && (!t.contentId || t.contentId !== self.contentId) && !contents.some((c) => c.id === t.contentId) && same(t.settings?.focusKeyword)) out.push({ title: t.title, where: `Plan · ${t.date.split('-').reverse().join('/')}` });
  return out.slice(0, 5);
}

/** Cài đặt › AI: biến thể nội dung — ẩn lựa chọn, đổi mặc định, thêm lựa chọn riêng, quản lý bộ cài sẵn */
export function VariantSettingsPanel() {
  const { hubCfg, setHubCfg, canDo } = useApp();
  const cfg = vCfgOf(hubCfg.content);
  const ro = !canDo('mkt.manage');
  const setCfg = (p: Partial<ContentVariantCfg>) => setHubCfg((c) => ({ ...c, content: { ...vCfgOf(c.content), ...p } }));
  const [add, setAdd] = useState<{ group: string; label: string; prompt: string }>({ group: 'proof', label: '', prompt: '' });
  return (
    <Panel title="Biến thể nội dung & hình ảnh (Plan, Content)">
      <p className="mb-3 text-xs text-[rgb(var(--muted))]">Bấm ô để ẩn / hiện lựa chọn; bấm "mặc định" để đổi lựa chọn mặc định của doanh nghiệp. Mỗi doanh nghiệp (VASSH, ALUX) có cấu hình riêng.</p>
      <div className="space-y-3">
        {VARIANT_GROUPS.map((g) => {
          const opts = [...g.options, ...cfg.custom.filter((c) => c.group === g.id).map((c) => ({ ...c, custom: true }))];
          const defs = cfg.defaults[g.id] ?? opts.filter((o) => o.def).map((o) => o.id);
          return (
            <div key={g.id}>
              <p className="mb-1 text-xs font-medium">{g.kind === 'image' ? 'Ảnh · ' : ''}{g.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {opts.map((o) => {
                  const k = `${g.id}:${o.id}`, hidden = cfg.hidden.includes(k), isDef = defs.includes(o.id);
                  return (
                    <span key={k} className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs', hidden ? 'border-dashed border-[rgb(var(--line))] text-[rgb(var(--faint))] line-through' : isDef ? 'border-[rgb(var(--fg)/0.35)]' : 'border-[rgb(var(--line))]')}>
                      <button type="button" disabled={ro} onClick={() => setCfg({ hidden: hidden ? cfg.hidden.filter((x) => x !== k) : [...cfg.hidden, k] })} title={o.prompt}>{o.label}{o.channels ? ` (${o.channels.join(', ')})` : ''}</button>
                      <button type="button" disabled={ro} aria-label={`Mặc định: ${o.label}`} className={cn('text-[10px]', isDef ? 'font-semibold text-[rgb(var(--fg))]' : 'text-[rgb(var(--faint))] hover:text-[rgb(var(--muted))]')} onClick={() => setCfg({ defaults: { ...cfg.defaults, [g.id]: g.multi ? (isDef ? defs.filter((x) => x !== o.id) : [...defs, o.id]) : [o.id] } })}>{isDef ? '· mặc định' : '· đặt mặc định'}</button>
                      {o.custom && !ro && <button type="button" aria-label={`Xóa ${o.label}`} className="text-[rgb(var(--faint))] hover:text-[rgb(var(--danger-fg))]" onClick={() => setCfg({ custom: cfg.custom.filter((c) => !(c.group === g.id && c.id === o.id)) })}>×</button>}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {!ro && (
        <form className="mt-4 grid gap-2 rounded-md bg-[rgb(var(--sunken))] p-3 sm:grid-cols-[160px_180px_1fr_auto]" onSubmit={(e) => { e.preventDefault(); if (!add.label.trim()) return; setCfg({ custom: [...cfg.custom, { group: add.group, id: uid('cv'), label: add.label.trim(), prompt: add.prompt.trim() || add.label.trim() }] }); setAdd({ ...add, label: '', prompt: '' }); }}>
          <select className={inputCls} value={add.group} onChange={(e) => setAdd({ ...add, group: e.target.value })} aria-label="Nhóm">{VARIANT_GROUPS.filter((g) => !['imgCount', 'imgAspect', 'imgStamp', 'length', 'sections'].includes(g.id)).map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select>
          <input className={inputCls} value={add.label} onChange={(e) => setAdd({ ...add, label: e.target.value })} placeholder="Tên lựa chọn" aria-label="Tên lựa chọn" />
          <input className={inputCls} value={add.prompt} onChange={(e) => setAdd({ ...add, prompt: e.target.value })} placeholder="Chỉ dẫn cho AI (VD: Nhắc bảo hành 10 năm của 3M)" aria-label="Chỉ dẫn cho AI" />
          <button className={cn(btnGhost, btnSm)}>+ Thêm</button>
        </form>
      )}
      {cfg.presets.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-medium">Bộ cài sẵn</p>
          <ul className="flex flex-wrap gap-1.5">{cfg.presets.map((p) => <li key={p.id} className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--line))] px-2.5 py-0.5 text-xs">{p.name}{!ro && <button type="button" aria-label={`Xóa bộ ${p.name}`} className="text-[rgb(var(--faint))] hover:text-[rgb(var(--danger-fg))]" onClick={() => setCfg({ presets: cfg.presets.filter((x) => x.id !== p.id) })}>×</button>}</li>)}</ul>
        </div>
      )}
    </Panel>
  );
}

/** Cảnh báo trùng từ khóa chính với bài / nhiệm vụ khác */
export function KwConflictNote({ kw, self }: { kw: string; self: { contentId?: string; taskId?: string } }) {
  const { contents, mktTasks } = useApp();
  const list = useMemo(() => kwConflicts(kw, self, contents, mktTasks), [kw, self.contentId, self.taskId, contents, mktTasks]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!list.length) return null;
  return (
    <div className="rounded-md bg-[rgb(var(--accent)/0.12)] px-3 py-2 text-xs" role="status">
      <b>Từ khóa "{kw}" trùng với {list.length} bài khác</b>: các bài sẽ tranh thứ hạng Google với nhau. Đổi góc từ khóa (thêm ứng dụng, địa phương, đối tượng) hoặc gộp bài.
      <ul className="mt-1 list-disc pl-4">{list.map((x, i) => <li key={i}>{x.title} <span className="text-[rgb(var(--muted))]">· {x.where}</span></li>)}</ul>
    </div>
  );
}

/** Mở bài trong Content Studio từ bất kỳ đâu, kể cả khi đang đứng ở Marketing Hub (tab khác) */
export function openMktContent(id: string, go: (m: Module) => void) {
  stickyStore.set('Mkt.tab', 'content');
  stickyStore.set('Mkt.openContent', id);
  go('marketing');
  setTimeout(() => window.dispatchEvent(new CustomEvent(MKT_OPEN_EVT, { detail: id })), 0);
}

/** Quyết định duyệt dùng chung: đổi trạng thái, ghi chú, mốc lịch sử, nhật ký duyệt, báo người gửi */
export function useContentDecision() {
  const { setContents, contents, me, users, dispatch, logDecision, notify, company, hubCfg, setContentVersions } = useApp();
  return (id: string, decision: 'APPROVED' | 'NEED_INFO' | 'PUBLISHED', note?: string) => {
    const c = contents.find((x) => x.id === id);
    if (!c || !me) return;
    const now = Date.now();
    const requester = c.submittedBy ?? c.aiJob?.by ?? c.ownerId;
    setContents((p) => p.map((x) => (x.id !== id ? x : decision === 'APPROVED' ? { ...x, status: 'APPROVED', approvedBy: me.id, approvedAt: now, reviewNote: undefined, updatedAt: now }
      : decision === 'PUBLISHED' ? { ...x, status: 'PUBLISHED', updatedAt: now } : { ...x, status: 'DRAFT', reviewNote: note, updatedAt: now })));
    if (decision === 'PUBLISHED') { notify(`Đã đánh dấu đã đăng "${c.title}"`, 'teal'); return; }
    if (decision === 'APPROVED') {
      const co = stCompanyOf(company);
      const v = wsMakeVersion(contentToArticle(c, co), co, c.id, 'APPROVED', me.name, hubCfg.ai.cliches?.length ? hubCfg.ai.cliches : HS_CLICHES_DEFAULT);
      if (v) setContentVersions((p) => wsPushVersion(p, v));
    }
    logDecision({ kind: 'CONTENT', refId: c.id, title: `Nội dung: ${c.title}`, requesterId: requester, decision, note });
    const to = users.find((u) => u.id === requester);
    if (to && to.id !== me.id) dispatch('APPROVAL_RESULT', { to, title: `${decision === 'APPROVED' ? 'Đã duyệt' : 'Cần sửa'}: ${c.title}`, body: note ?? 'Nội dung đã được duyệt', module: 'marketing' });
    notify(decision === 'APPROVED' ? `Đã duyệt "${c.title}"` : `Đã trả về "${c.title}" để sửa`, decision === 'APPROVED' ? 'teal' : 'orange');
  };
}

/** Đặt một lần ở khung app: nhận yêu cầu "Xem & duyệt" và mở khung duyệt */
export function ContentReviewHost() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const f = (e: Event) => setId(String((e as CustomEvent<string>).detail ?? '') || null);
    window.addEventListener(MKT_REVIEW_EVT, f);
    return () => window.removeEventListener(MKT_REVIEW_EVT, f);
  }, []);
  return id ? <ContentReviewSheet id={id} onClose={() => setId(null)} /> : null;
}

/**
 * Khung duyệt: đọc bài đúng như sẽ đăng (bản xuất bản theo kênh), điểm SEO, Human Score, thông số còn thiếu;
 * Duyệt / Trả về sửa (bắt buộc ghi lý do) / Mở để sửa. Không cần đi qua Cài đặt → Dàn ý → Workspace.
 */
export function ContentReviewSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { contents, canDo, company, hubCfg, go, userName } = useApp();
  const decide = useContentDecision();
  const [note, setNote] = useState<string | null>(null);
  const co = useMemo(() => stCompanyOf(company), [company]);
  const c = contents.find((x) => x.id === id);
  const data = useMemo(() => {
    if (!c) return null;
    const art0 = contentToArticle(c, co);
    const art = { ...art0, doc: art0.doc ?? wsArticleToDoc(art0) };
    const p = getPlatform(art.platform);
    return { art, p, out: p.render(art, co), seo: scoreArticle(art, p, co), human: wsHumanReport(wsBlocks(art.doc), hubCfg.ai.cliches?.length ? hubCfg.ai.cliches : HS_CLICHES_DEFAULT), missing: p.validate(art.settings) };
  }, [c, co, hubCfg.ai.cliches]);
  if (!c || !data) return null;
  const { art, p, out, seo, human, missing } = data;
  const running = c.aiJob?.status === 'QUEUED' || c.aiJob?.status === 'RUNNING';
  const can = canDo('mkt.manage');
  const tone = (n: number) => (n >= 80 ? 'text-[rgb(var(--success-fg))]' : n >= 50 ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--danger-fg))]');
  const requester = c.submittedBy ?? c.aiJob?.by ?? c.ownerId;
  return (
    <SideSheet title={c.title || 'Nội dung'} width="sm:w-[820px]" onClose={onClose}
      sub={<span className="inline-flex flex-wrap items-center gap-1.5"><Chip tone={CONTENT_STATUS[c.status].tone}>{CONTENT_STATUS[c.status].label}</Chip>{p.label}{requester ? ` · gửi bởi ${userName(requester)}` : ''}{c.aiJob?.status === 'DONE' ? ' · AI soạn' : ''}</span>}
      footer={<>
        <button className={cn(btnGhost, 'mr-auto')} onClick={() => { onClose(); openMktContent(c.id, go); }}><ExternalLink className="h-4 w-4" aria-hidden />Mở để sửa</button>
        {can && c.status === 'REVIEW' && !running && note === null && <>
          <button className={btnGhost} onClick={() => setNote('')}>Trả về sửa</button>
          <button className={btnPrimary} onClick={() => { decide(c.id, 'APPROVED'); onClose(); }}><CheckCircle2 className="h-4 w-4" aria-hidden />Duyệt</button>
        </>}
        {can && c.status === 'REVIEW' && note !== null && (
          <form className="flex flex-1 items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; decide(c.id, 'NEED_INFO', note.trim()); onClose(); }}>
            <input autoFocus className={cn(inputCls, 'h-9 py-0')} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cần sửa gì? (bắt buộc)" aria-label="Lý do trả về" />
            <button className={btnPrimary} disabled={!note.trim()}>Trả về</button>
            <button type="button" className={btnGhost} onClick={() => setNote(null)}>Hủy</button>
          </form>
        )}
        {can && c.status === 'APPROVED' && <button className={btnPrimary} onClick={() => { decide(c.id, 'PUBLISHED'); onClose(); }}>Đánh dấu đã đăng</button>}
      </>}>
      <div className="space-y-4">
        {running && <p className="rounded-md bg-[#FEF9C3] px-3 py-2 text-sm text-[#713F12]">AI đang soạn lại bài này ({c.aiJob?.step ?? 'đang chạy'}), chờ xong mới duyệt được.</p>}
        {c.status === 'DRAFT' && c.reviewNote && <p className="rounded-md bg-[rgb(var(--accent)/0.12)] px-3 py-2 text-sm"><b>Đã trả về:</b> {c.reviewNote}</p>}
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-md bg-[rgb(var(--sunken))] p-2.5"><dt className="text-[11px] text-[rgb(var(--muted))]">Điểm SEO {p.label}</dt><dd className={cn('text-xl font-bold tabular-nums', tone(seo.score))}>{seo.score}</dd></div>
          <div className="rounded-md bg-[rgb(var(--sunken))] p-2.5"><dt className="text-[11px] text-[rgb(var(--muted))]">Tự nhiên (ước lượng)</dt><dd className={cn('text-xl font-bold tabular-nums', human.scored ? tone(human.score + 10) : '')}>{human.scored ? human.score : '—'}</dd></div>
          <div className="rounded-md bg-[rgb(var(--sunken))] p-2.5"><dt className="text-[11px] text-[rgb(var(--muted))]">Số từ · ảnh</dt><dd className="text-xl font-bold tabular-nums">{seo.words.toLocaleString('vi-VN')} · {seo.images}</dd></div>
          <div className="rounded-md bg-[rgb(var(--sunken))] p-2.5"><dt className="text-[11px] text-[rgb(var(--muted))]">Từ khóa chính</dt><dd className="truncate text-sm font-semibold">{stStr(art.settings.focusKeyword) || stStr(art.settings.localKeyword) || '—'}</dd></div>
        </dl>
        {missing.length > 0 && <p className="rounded-md bg-[rgb(var(--danger)/0.1)] px-3 py-2 text-sm text-[rgb(var(--danger-fg))]">Thiếu thông số kênh: {missing.join(', ')}. Bấm "Mở để sửa" → Cài đặt.</p>}
        {seo.items.some((x) => x.status !== 'pass') && (
          <details className="rounded-md border border-[rgb(var(--line))] px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium">{seo.items.filter((x) => x.status !== 'pass').length} tiêu chí SEO chưa đạt</summary>
            <ul className="mt-2 space-y-1">{seo.items.filter((x) => x.status !== 'pass').map((x) => <li key={x.id} className="flex gap-2"><span className={x.status === 'fail' ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--accent-fg))]'}>{x.status === 'fail' ? '✕' : '!'}</span><span>{x.label} <span className="text-xs text-[rgb(var(--muted))]">· {x.detail}</span></span></li>)}</ul>
          </details>
        )}
        {human.blocks.length > 0 && <p className="text-xs text-[rgb(var(--muted))]">{human.blocks.length} đoạn nên biên tập cho tự nhiên hơn (xem tab Tự nhiên khi mở để sửa).</p>}
        {out.meta?.title && (
          <div className="rounded-md border border-[rgb(var(--line))] p-3">
            <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--muted))]">Hiển thị trên Google (mô phỏng)</p>
            <p className="mt-1 truncate text-[17px] text-[#1a0dab]">{out.meta.title}</p>
            <p className="truncate text-xs text-[#006621]">{co.website || 'website'}/{stStr(art.settings.slug)}</p>
            <p className="line-clamp-2 text-[13px] text-[rgb(var(--fg2))]">{out.meta.description}</p>
          </div>
        )}
        <article className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-5">
          <style>{WS_CSS}</style>
          {out.format === 'html'
            ? <div className="ws-prose" style={{ paddingBottom: 0, fontSize: 15.5 }} dangerouslySetInnerHTML={{ __html: out.body }} />
            : <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-relaxed">{out.body}</pre>}
        </article>
      </div>
    </SideSheet>
  );
}

// ---- workspace/plan.tsx (v38.6): Plan · Content · Image · Budget · Automation; form gọn bằng tab, chọn nhanh, mẫu cài sẵn ----

// ---------- Điều khiển chọn gọn ----------

/** Thanh chọn liền khối cho 2–3 lựa chọn (như nút Sáng / Tối) */
export function Segmented({ options, value, onChange, ariaLabel, disabled }: { options: { id: string; label: string; title?: string }[]; value: string | undefined; onChange: (id: string) => void; ariaLabel: string; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex w-full rounded-md bg-[rgb(var(--ink)/0.06)] p-0.5">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} disabled={disabled} title={o.title} onClick={() => onChange(o.id)}
            className={cn('min-w-0 flex-1 truncate rounded px-2 py-1.5 text-xs transition-colors', on ? 'bg-[rgb(var(--surface))] font-semibold text-[rgb(var(--fg))] shadow-sm' : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')}>{o.label}</button>
        );
      })}
    </div>
  );
}

/** Ô chọn xổ xuống (chọn 1 hoặc nhiều), có ô tìm khi nhiều lựa chọn; đã chọn hiện thành thẻ nhỏ trong ô */
export function SelectMenu({ options, value, multi, onChange, placeholder, ariaLabel, disabled, defaults }: { options: MenuOption[]; value: string[]; multi?: boolean; onChange: (v: string[]) => void; placeholder?: string; ariaLabel: string; disabled?: boolean; defaults?: string[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const f = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, [open]);
  const sel = value.map((id) => options.find((o) => o.id === id)).filter((o): o is MenuOption => !!o);
  const list = options.filter((o) => !q || stFold(`${o.label} ${o.hint ?? ''}`).includes(stFold(q)));
  const pick = (id: string) => { if (multi) onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]); else { onChange([id]); setOpen(false); } };
  return (
    <div ref={ref} className="relative">
      <div role="combobox" aria-expanded={open} aria-haspopup="listbox" aria-label={ariaLabel} tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={(e) => { if (disabled) return; if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); } if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); } }}
        className={cn('flex min-h-[36px] w-full cursor-pointer flex-wrap items-center gap-1 rounded-md border bg-[rgb(var(--surface))] py-1 pl-2 pr-7 text-sm', open ? 'border-[rgb(var(--accent))]' : 'border-[rgb(var(--line))]', disabled && 'cursor-default opacity-60')}>
        {!sel.length && <span className="px-0.5 text-[rgb(var(--faint))]">{placeholder ?? 'Chọn…'}</span>}
        {!multi && sel[0] && <span className="flex min-w-0 items-center gap-1.5 px-0.5">{sel[0].img && <img src={sel[0].img} alt="" className="h-5 w-5 rounded object-cover" />}<span className="truncate">{sel[0].label}</span></span>}
        {multi && sel.map((o) => (
          <span key={o.id} className="inline-flex max-w-full items-center gap-1 rounded bg-[rgb(var(--accent)/0.12)] px-1.5 py-0.5 text-xs text-[rgb(var(--fg))]">
            {o.img && <img src={o.img} alt="" className="h-4 w-4 rounded object-cover" />}<span className="truncate">{o.label}</span>
            {!disabled && <button type="button" aria-label={`Bỏ ${o.label}`} className="text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={(e) => { e.stopPropagation(); pick(o.id); }}>×</button>}
          </span>
        ))}
        <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />
      </div>
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] shadow-xl">
          {options.length > 6 && <div className="border-b border-[rgb(var(--line))] p-1.5"><input autoFocus className={cn(inputBase, 'h-8 w-full py-0 text-xs')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Gõ để tìm…" aria-label="Tìm lựa chọn" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }} /></div>}
          <ul role="listbox" aria-multiselectable={multi} className="max-h-60 overflow-y-auto p-1">
            {list.map((o) => {
              const on = value.includes(o.id);
              return (
                <li key={o.id} role="option" aria-selected={on}>
                  <button type="button" onClick={() => pick(o.id)} className={cn('flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[rgb(var(--ink)/0.05)]', on && !multi && 'bg-[rgb(var(--accent)/0.08)]')}>
                    {multi && <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]', on ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))] text-white' : 'border-[rgb(var(--line))]')}>{on ? '✓' : ''}</span>}
                    {o.img && <img src={o.img} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />}
                    <span className={cn('min-w-0 flex-1', on && !multi && 'font-semibold')}>{o.label}{o.hint && <span className="block truncate text-[11px] text-[rgb(var(--muted))]">{o.hint}</span>}</span>
                    {defaults?.includes(o.id) && <span className="shrink-0 text-[10px] text-[rgb(var(--faint))]">mặc định</span>}
                  </button>
                </li>
              );
            })}
            {!list.length && <li className="px-2 py-2 text-xs text-[rgb(var(--muted))]">Không có lựa chọn</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Nút AI nhỏ (tia sáng) đặt ở góc phải ô nhập hoặc tiêu đề khối */
export function AiSpark({ onClick, busy, title, disabled, className }: { onClick: () => void; busy?: boolean; title: string; disabled?: boolean; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || busy} title={title} aria-label={title}
      className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md text-[rgb(var(--accent))] transition-colors hover:bg-[rgb(var(--accent)/0.12)] disabled:opacity-40', className)}>
      {busy ? <RefreshCw className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
    </button>
  );
}

/** Khối nhóm trường: nền xám rất nhạt, viền mờ */
export function FormCard({ title, aside, children, className }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-lg border border-[rgb(var(--line)/0.8)] bg-[rgb(var(--ink)/0.025)] p-3.5', className)}>
      {(title || aside) && <div className="mb-3 flex items-center gap-2"><p className="min-w-0 flex-1 text-[13px] font-semibold">{title}</p>{aside}</div>}
      {children}
    </section>
  );
}

/** Tab ngang trong khung bên (dính trên cùng khi cuộn) */
export function SheetTabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; dot?: boolean }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="sticky -top-4 z-20 -mx-5 -mt-4 mb-4 flex border-b border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-5">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cn('relative -mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm', value === t.id ? 'border-[rgb(var(--accent))] font-semibold text-[rgb(var(--fg))]' : 'border-transparent text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')}>
          {t.label}{t.dot && <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--danger))]" aria-label="còn thiếu thông tin" />}
        </button>
      ))}
    </div>
  );
}

/** Một nhóm biến thể -> điều khiển phù hợp: ≤ 3 lựa chọn = thanh chọn liền khối; nhiều hơn = ô xổ xuống (chọn 1 / nhiều) */
export function VariantControl({ g, values, cfg, onChange, ro }: { g: VariantGroup; values: StSettings; cfg: ContentVariantCfg; onChange: (next: StSettings) => void; ro?: boolean }) {
  const picked = vPicked(g, values, cfg);
  const defs = cfg.defaults[g.id] ?? g.options.filter((o) => o.def).map((o) => o.id);
  const set = (ids: string[]) => onChange(g.id === 'type' && ids[0] ? vApplyType(values, ids[0], cfg) : { ...values, [vKey(g.id)]: ids });
  const opts = g.options.map((o) => ({ id: o.id, label: o.label, hint: o.prompt && o.prompt.length < 90 ? o.prompt : undefined }));
  const control = !g.multi && g.options.length <= 3
    ? <Segmented ariaLabel={g.label} options={g.options.map((o) => ({ id: o.id, label: o.label, title: o.prompt }))} value={picked[0]} onChange={(id) => set([id])} disabled={ro} />
    : g.multi && g.options.length <= 3
      ? <div className="flex flex-wrap gap-1.5" role="group" aria-label={g.label}>{g.options.map((o) => { const on = picked.includes(o.id); return <button key={o.id} type="button" role="checkbox" aria-checked={on} disabled={ro} title={o.prompt} onClick={() => set(on ? picked.filter((x) => x !== o.id) : [...picked, o.id])} className={cn('rounded-md border px-2.5 py-1.5 text-xs', on ? 'border-[rgb(var(--accent)/0.6)] bg-[rgb(var(--accent)/0.1)] font-medium' : 'border-[rgb(var(--line))] bg-[rgb(var(--surface))]')}>{on ? '✓ ' : ''}{o.label}</button>; })}</div>
      : <SelectMenu ariaLabel={g.label} options={opts} value={picked} multi={g.multi} onChange={set} disabled={ro} defaults={defs} placeholder={g.multi ? 'Chọn một hoặc nhiều…' : 'Chọn…'} />;
  return (
    <div className={cn(g.id === 'type' || (g.multi && g.options.length > 3) || (g.options.length <= 3 && g.options.some((o) => o.label.length > 10)) ? 'col-span-2' : '')}>
      <p className="mb-1 text-xs font-medium text-[rgb(var(--muted))]">{g.label}{g.hint ? <span className="font-normal text-[rgb(var(--faint))]"> · {g.hint}</span> : null}</p>
      {control}
    </div>
  );
}

/**
 * Cấu hình nội dung / hình ảnh: Mẫu nhanh (nổi bật, kèm AI gợi ý) → [khối chèn giữa, VD thông số kênh] → các nhóm thường dùng → "+ Hiện cài đặt nâng cao".
 * Thay cho bộ chip v38.2 (thay tên giữ nguyên để các nơi dùng cũ không đổi).
 */
export function VariantPicker({ kind, platform, values, onChange, title, context, ro, middle, advancedExtra }: { kind: VariantKind; platform?: string; values: StSettings; onChange: (next: StSettings) => void; title: string; context?: string; ro?: boolean; middle?: ReactNode; advancedExtra?: ReactNode }) {
  const { hubCfg, setHubCfg, canDo, notify, skus } = useApp();
  const ai = useAi('writer');
  const cfg = vCfgOf(hubCfg.content);
  const groups = vGroups(cfg, platform, kind);
  const basic = groups.filter((g) => !g.adv);
  const adv = groups.filter((g) => g.adv);
  const [showAdv, setShowAdv] = useState(false);
  const [preview, setPreview] = useState(false);
  const [sugs, setSugs] = useState<{ name: string; why: string; pick: Record<string, string[]> }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [presetName, setPresetName] = useState<string | null>(null);
  const tplId = stArr(values[vKey('tpl')])[0];
  const tpls = CONTENT_TEMPLATES.filter((t) => !t.channels || !platform || t.channels.includes(platform));
  const presets = cfg.presets.filter((p) => Object.keys(p.values).some((k) => groups.some((g) => vKey(g.id) === k)));
  const applyValues = (vals: Record<string, string[]>, id: string) => {
    let next: StSettings = { ...values };
    if (vals.type?.[0]) next = vApplyType(next, vals.type[0], cfg);
    for (const [k, ids] of Object.entries(vals)) next[k.startsWith('v_') ? k : vKey(k)] = ids;
    next[vKey('tpl')] = [id];
    onChange(next);
  };
  const savePreset = (name: string) => {
    const all = vGroups(cfg, platform);
    const vals = Object.fromEntries(all.map((g) => [vKey(g.id), vPicked(g, values, cfg)]));
    setHubCfg((c) => ({ ...c, content: { ...vCfgOf(c.content), presets: [...vCfgOf(c.content).presets, { id: uid('vp'), name, values: vals }] } }));
    notify(`Đã lưu mẫu "${name}"`, 'teal'); setPresetName(null);
  };
  const suggest = async () => {
    setBusy(true); setSugs(null);
    const all = vGroups(cfg, platform);
    const menu = all.map((g) => `${g.id} (${g.multi ? 'chọn nhiều' : 'chọn 1'}): ${g.options.map((o) => `${o.id}=${o.label}`).join('; ')}`).join('\n');
    const r = await ai.ask({ maxTokens: 1800, system: 'Bạn là trưởng biên tập nội dung B2B. Chỉ trả về đúng 1 đối tượng JSON hợp lệ, không markdown, không giải thích.', prompt: `Đề xuất 3 tổ hợp cài đặt nội dung và hình ảnh khác nhau cho bài "${title}"${platform ? ` trên kênh ${getPlatform(platform).label}` : ''}. ${context ? `Thông tin thêm: ${context.slice(0, 600)}. ` : ''}\nCác nhóm và mã lựa chọn:\n${menu}\nTrả JSON {"options":[{"name":"tên ngắn","why":"1 câu vì sao hợp","pick":{"<mã nhóm>":["<mã lựa chọn>"]}}]}` });
    setBusy(false);
    const j = r.ok ? parseAiJson<{ options?: { name?: string; why?: string; pick?: Record<string, string[] | string> }[] }>(r.text) : null;
    if (!j?.options?.length) { if (r.ok) console.warn('[AI gợi ý mẫu] không đọc được JSON:', r.text); notify(r.ok ? 'AI trả lời không đúng định dạng, bấm lại lần nữa' : `AI chưa trả lời được: ${r.error}`, 'orange'); return; }
    setSugs(j.options.slice(0, 3).map((o) => ({ name: String(o.name ?? 'Phương án'), why: String(o.why ?? ''), pick: Object.fromEntries(Object.entries(o.pick ?? {}).filter(([g]) => all.some((x) => x.id === g)).map(([g, ids]) => [g, (Array.isArray(ids) ? ids : [ids]).map(String).filter((id) => all.find((x) => x.id === g)?.options.some((o2) => o2.id === id))])) })));
  };
  const refs = stArr(values[vKey('imgRef')]);
  const withImg = skus.filter((x) => x.image && !x.archived);
  return (
    <div className="space-y-3">
      {kind === 'text' && (
        <FormCard title="Mẫu nhanh" aside={<>
          {!ro && canDo('mkt.manage') && <button type="button" className="text-[11px] font-medium text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => setPresetName('')}>Lưu cấu hình thành mẫu</button>}
          {!ro && ai.available && <AiSpark title="AI gợi ý 3 cấu hình hợp với tiêu đề" busy={busy} disabled={!title.trim()} onClick={() => void suggest()} />}
        </>}>
          <div className="grid grid-cols-2 gap-2">
            {[...tpls.map((t) => ({ id: t.id, name: t.name, desc: t.desc, vals: t.values })), ...presets.map((p) => ({ id: p.id, name: p.name, desc: 'Mẫu riêng của doanh nghiệp', vals: p.values }))].map((t) => (
              <button key={t.id} type="button" disabled={ro} onClick={() => applyValues(t.vals, t.id)}
                className={cn('rounded-md border bg-[rgb(var(--surface))] p-2.5 text-left transition-colors', tplId === t.id ? 'border-[rgb(var(--accent))] ring-1 ring-[rgb(var(--accent)/0.4)]' : 'border-[rgb(var(--line))] hover:border-[rgb(var(--accent)/0.5)]')}>
                <span className="block text-[13px] font-semibold leading-snug">{tplId === t.id ? '✓ ' : ''}{t.name}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-[rgb(var(--muted))]">{t.desc}</span>
              </button>
            ))}
          </div>
          {presetName !== null && (
            <form className="mt-2 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (presetName.trim()) savePreset(presetName.trim()); }}>
              <input autoFocus className={cn(inputBase, 'h-8 min-w-0 flex-1 py-0 text-xs')} value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Tên mẫu, VD: Bài SEO sản phẩm 3M" aria-label="Tên mẫu" />
              <button className={cn(btnPrimary, btnSm)}>Lưu</button><button type="button" className={cn(btnGhost, btnSm)} onClick={() => setPresetName(null)}>Hủy</button>
            </form>
          )}
          {sugs && (
            <div className="mt-2 grid gap-2">
              {sugs.map((s0, i) => (
                <button key={i} type="button" onClick={() => { applyValues(s0.pick, `ai${i}`); setSugs(null); }} className="rounded-md border border-[rgb(var(--accent)/0.4)] bg-[rgb(var(--accent)/0.05)] p-2 text-left text-xs hover:border-[rgb(var(--accent))]">
                  <b className="text-[13px]">✦ {s0.name}</b> <span className="text-[rgb(var(--muted))]">{s0.why}</span>
                </button>
              ))}
            </div>
          )}
        </FormCard>
      )}
      {middle}
      <FormCard title={kind === 'text' ? 'Yêu cầu soạn bài' : 'Yêu cầu hình ảnh'}>
        <div className="grid grid-cols-2 gap-3">
          {basic.map((g) => <VariantControl key={g.id} g={g} values={values} cfg={cfg} onChange={onChange} ro={ro} />)}
          {kind === 'image' && (
            <div className="col-span-2">
              <p className="mb-1 text-xs font-medium text-[rgb(var(--muted))]">Ảnh tham chiếu từ danh mục sản phẩm (tối đa 2)</p>
              {withImg.length
                ? <SelectMenu ariaLabel="Ảnh tham chiếu" multi value={refs} disabled={ro} onChange={(v) => onChange({ ...values, [vKey('imgRef')]: v.slice(-2) })} placeholder="Chọn sản phẩm để AI bám theo hình thật…" options={withImg.slice(0, 200).map((x) => ({ id: x.sku, label: x.sku, hint: x.name, img: x.image }))} />
                : <p className="text-xs text-[rgb(var(--faint))]">Chưa có sản phẩm nào có ảnh (Sản phẩm › sửa mã hàng › Ảnh).</p>}
            </div>
          )}
        </div>
      </FormCard>
      <div className="flex items-center justify-between gap-3">
        {(adv.length > 0 || advancedExtra) ? <button type="button" className="text-xs font-medium text-[rgb(var(--secondary-fg))] hover:underline" aria-expanded={showAdv} onClick={() => setShowAdv((v) => !v)}>{showAdv ? '− Ẩn cài đặt nâng cao' : '+ Hiện cài đặt nâng cao'}</button> : <span />}
        <button type="button" className="text-[11px] text-[rgb(var(--muted))] hover:underline" onClick={() => setPreview((p) => !p)}>{preview ? 'Ẩn' : 'Xem'} chỉ dẫn sẽ gửi cho AI</button>
      </div>
      {(adv.length > 0 || advancedExtra) && (
        <>
          {showAdv && (
            <FormCard title="Cài đặt nâng cao">
              {adv.length > 0 && <div className="grid grid-cols-2 gap-3">{adv.map((g) => <VariantControl key={g.id} g={g} values={values} cfg={cfg} onChange={onChange} ro={ro} />)}</div>}
              {advancedExtra && <div className={adv.length ? 'mt-3' : ''}>{advancedExtra}</div>}
            </FormCard>
          )}
        </>
      )}
      {preview && <pre className="whitespace-pre-wrap rounded-md bg-[rgb(var(--sunken))] p-2.5 font-sans text-xs leading-relaxed">{(kind === 'text' ? `- ${vText(values, platform, 'text', cfg)}` : vText(values, platform, 'image', cfg)) || '(không có chỉ dẫn thêm)'}</pre>}
    </div>
  );
}

// ---------- Thông số kênh (SEO / Facebook / Zalo / Maps) dùng chung cho Nhiệm vụ & Chiến dịch ----------

/** AI điền các ô thông số còn trống từ tiêu đề (không ghi đè ô đã nhập) */
export function useAiFillSettings() {
  const ai = useAi('writer');
  const { company, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const run = async (title: string, platformId: string, note: string, settings: StSettings, apply: (next: StSettings) => void) => {
    const plat = getPlatform(platformId);
    if (!title.trim()) { notify('Nhập tiêu đề trước', 'orange'); return; }
    const co = stCompanyOf(company);
    setBusy(true);
    const ask = (extra = '') => ai.ask({ maxTokens: 1600, system: `Bạn là chuyên gia SEO tiếng Việt cho doanh nghiệp B2B. Chỉ trả về đúng 1 đối tượng JSON hợp lệ, không markdown, không giải thích.${extra}`, prompt: `Đề xuất thông số cho bài ${plat.label} có chủ đề "${title}" của ${co.name} (lĩnh vực ${co.sector}). ${note ? `Ghi chú: ${note}. ` : ''}Trả JSON {"focusKeyword":"cụm 2–5 từ người Việt hay tìm","lsiKeywords":["5–8 cụm liên quan"],"metaTitle":"≤ 60 ký tự, có từ khóa","metaDescription":"120–155 ký tự, có từ khóa và lợi ích","slug":"khong-dau-gach-noi","searchIntent":"info|compare|buy|local","audience":"mep|designer|owner|dealer|homeowner","keyMessage":"1 câu thông điệp chính","localKeyword":"từ khóa + địa phương nếu hợp","ctaText":"lời kêu gọi ngắn"}` });
    let r = await ask();
    let j = r.ok ? parseAiJson<Record<string, unknown>>(r.text) : null;
    if (r.ok && !j) { console.warn('[AI điền ô trống] câu trả lời không đọc được JSON:', r.text); r = await ask(' Lần trước trả lời sai định dạng: bắt đầu bằng { và kết thúc bằng }, mỗi giá trị ngắn gọn.'); j = r.ok ? parseAiJson<Record<string, unknown>>(r.text) : null; }
    setBusy(false);
    if (!j) { if (r.ok) console.warn('[AI điền ô trống] lần 2 vẫn sai:', r.text); notify(r.ok ? 'AI trả lời không đúng định dạng 2 lần. Thử lại, hoặc đổi mô hình AI ở Cài đặt › AI (chi tiết ở F12 › Console)' : `AI chưa trả lời được: ${r.error}`, 'orange'); return; }
    const keys = new Set([...plat.fields.map((x) => x.key), ...ST_BRIEF_FIELDS.map((x) => x.key)]);
    const cur = { ...settings };
    let n = 0;
    for (const [k, v] of Object.entries(j)) {
      if (k === 'audience') { if (['mep', 'designer', 'owner', 'dealer', 'homeowner'].includes(String(v)) && !Array.isArray(cur[vKey('audience')])) { cur[vKey('audience')] = [String(v)]; n++; } continue; }
      if (!keys.has(k)) continue;
      const old = cur[k];
      const empty = old == null || (Array.isArray(old) ? old.length === 0 : String(old).trim() === '' || (k === 'searchIntent' && old === 'info'));
      if (!empty) continue;
      if (Array.isArray(v)) { cur[k] = v.map(String).filter(Boolean).slice(0, 10); n++; }
      else if (typeof v === 'string' && v.trim()) { cur[k] = k === 'metaTitle' ? stClip(v, 60) : k === 'metaDescription' ? stClip(v, 155) : k === 'slug' ? slugify(v) : v.trim(); n++; }
    }
    apply(cur);
    notify(n ? `AI đã điền ${n} ô còn trống, kiểm tra lại trước khi giao` : 'Các ô đã có dữ liệu, AI không ghi đè', 'teal');
  };
  return { run, busy, available: ai.available };
}

/** Khối "Thông số {kênh}": các trường của kênh; ô từ khóa có nút AI ở góc phải */
export function ChannelSettingsCard({ platformId, title, note, settings, onChange, ro, self }: { platformId: string; title: string; note: string; settings: StSettings; onChange: (next: StSettings) => void; ro?: boolean; self: { taskId?: string; contentId?: string } }) {
  const { company } = useApp();
  const co = useMemo(() => stCompanyOf(company), [company]);
  const plat = getPlatform(platformId);
  const fill = useAiFillSettings();
  const errs = plat.validate(settings);
  const aiKey = plat.fields.find((x) => x.key === 'focusKeyword' || x.key === 'localKeyword' || x.key === 'ctaText')?.key;
  const fake = (): StArticle => ({ id: 'x', platform: platformId, title, sapo: '', sections: [], settings, updatedAt: Date.now() });
  const runFill = () => void fill.run(title, platformId, note, settings, onChange);
  return (
    <FormCard title={`Thông số ${plat.label}`} aside={!ro && fill.available ? <AiSpark title="AI điền các ô còn trống từ tiêu đề" busy={fill.busy} disabled={!title.trim()} onClick={runFill} /> : null}>
      <div className="grid grid-cols-2 gap-3">
        {plat.fields.filter((x) => !x.showIf || x.showIf(settings)).map((x) => (
          <StFieldControl key={x.key} f={x} value={settings[x.key]} company={co} onChange={(v) => onChange({ ...settings, [x.key]: v })}
            onSuggest={x.suggest ? () => onChange({ ...settings, [x.key]: x.suggest!(fake(), settings) }) : undefined}
            onAi={!ro && fill.available && x.key === aiKey ? runFill : undefined} aiBusy={fill.busy} />
        ))}
      </div>
      {stStr(settings.focusKeyword).trim() && <div className="mt-3"><KwConflictNote kw={stStr(settings.focusKeyword)} self={self} /></div>}
      {errs.length > 0 && <p className="mt-2 text-xs text-[rgb(var(--danger-fg))]" role="alert">Cần nhập trước khi giao AI: {errs.join(', ')}</p>}
    </FormCard>
  );
}

// ---------- Nhiệm vụ nội dung (tab Plan) ----------

export function TaskSheet({ t, onClose }: { t: MktTask; onClose: () => void }) {
  const { mktTasks, setMktTasks, campaigns, contents, users, canDo, notify, go, company } = useApp();
  const assign = useAssignToAi();
  const stCo = useMemo(() => stCompanyOf(company), [company]);
  const [tab, setTab] = useState<'general' | 'content' | 'image'>('general');
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
    const keep = Object.fromEntries(Object.entries(p.settings ?? {}).filter(([k]) => k.startsWith('v_') || getPlatform(np).fields.some((x) => x.key === k) || ST_BRIEF_FIELDS.some((x) => x.key === k)));
    return { ...p, channel: ch, platform: np, settings: { ...getPlatform(np).defaults(stCo), ...keep } };
  });
  const errs = plat ? plat.validate(sv) : [];
  const ro = !canDo('mkt.manage');
  const exists = mktTasks.some((x) => x.id === f.id);
  const live = mktTasks.find((x) => x.id === f.id) ?? f;
  const st = taskStatusOf(live, contents);
  const content = contents.find((c) => c.id === live.contentId);
  const save = (x = f) => setMktTasks((p) => (p.some((y) => y.id === x.id) ? p.map((y) => (y.id === x.id ? { ...x, contentId: y.contentId ?? x.contentId } : y)) : [x, ...p]));
  const openStudio = () => { if (!live.contentId) return; onClose(); openMktContent(live.contentId, go); };
  const canGive = !!f.title.trim() && st !== 'AI_QUEUED' && st !== 'PUBLISHED' && errs.length === 0;
  return (
    <SideSheet title={exists ? 'Nhiệm vụ nội dung' : 'Nhiệm vụ mới'} width="sm:w-[600px]" onClose={onClose}
      sub={<span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: TASK_STATUS[st].color }} aria-hidden />{TASK_STATUS[st].label}{content?.aiJob?.step ? ` · ${content.aiJob.step}` : ''}</span>}
      footer={ro ? <button className={btnGhost} onClick={onClose}>Đóng</button> : <>
        {exists && <button className={cn(btnGhost, 'mr-auto text-[rgb(var(--danger-fg))]')} onClick={() => { setMktTasks((p) => p.filter((x) => x.id !== f.id)); onClose(); }}>Xóa</button>}
        {!canGive && f.title.trim() && errs.length > 0 && <span className="mr-auto text-xs text-[rgb(var(--danger-fg))]">Thiếu: {errs.join(', ')}</span>}
        <button className={btnGhost} disabled={!f.title.trim()} onClick={() => { save(); notify('Đã lưu nhiệm vụ', 'teal'); onClose(); }}>Lưu</button>
        <button className={btnAccent} disabled={!canGive} title={errs.length ? `Cần nhập: ${errs.join(', ')}` : undefined} onClick={() => { save(); assign(f); onClose(); }}><Sparkles className="h-4 w-4" aria-hidden />{content ? 'Giao AI làm lại' : 'Giao cho AI xử lý'}</button>
      </>}>
      <SheetTabs value={tab} onChange={setTab} tabs={[{ id: 'general', label: 'Thông tin chung', dot: !f.title.trim() }, { id: 'content', label: 'Cấu hình nội dung', dot: errs.length > 0 }, { id: 'image', label: 'Cấu hình hình ảnh' }]} />
      <fieldset disabled={ro} className="min-w-0 space-y-3">
        {tab === 'general' && <>
          <ol className="flex items-center gap-1 text-[11px]" aria-label="Tiến trình">
            {(Object.keys(TASK_STATUS) as TaskStatus[]).map((s, i) => { const idx = (Object.keys(TASK_STATUS) as TaskStatus[]).indexOf(st); return (
              <li key={s} className="flex flex-1 items-center gap-1"><span className="h-1.5 flex-1 rounded-full" style={{ background: i <= idx ? TASK_STATUS[s].color : 'rgb(var(--line))' }} /><span className={cn('whitespace-nowrap', i === idx ? 'font-semibold' : 'text-[rgb(var(--muted))]')}>{TASK_STATUS[s].label}</span></li>
            ); })}
          </ol>
          <FormCard>
            <Field label="Tiêu đề / chủ đề bài"><input className={inputCls} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="VD: 5 lưu ý chọn đầu cáp co nguội cho trạm 24kV" /></Field>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Kênh phân phối"><select className={inputCls} value={f.channel} onChange={(e) => setChannel(e.target.value as MktChannel)}>{(Object.keys(MKT_CH) as MktChannel[]).map((k) => <option key={k} value={k}>{MKT_CH[k].label}{ST_OF_CHANNEL[k] ? '' : ' (soạn tự do)'}</option>)}</select></Field>
              <Field label="Ngày đăng"><input type="date" className={inputCls} value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
              <Field label="Chiến dịch"><select className={inputCls} value={f.campaignId ?? ''} onChange={(e) => set('campaignId', e.target.value || undefined)}><option value="">Không gắn</option>{campaigns.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
              <Field label="Loại nội dung"><select className={inputCls} value={f.contentType} onChange={(e) => set('contentType', e.target.value as MktContentType)}>{(Object.keys(WRITER) as WriterPreset[]).map((k) => <option key={k} value={k}>{WRITER[k].label}</option>)}</select></Field>
              <Field label="Phụ trách"><select className={inputCls} value={f.ownerId ?? ''} onChange={(e) => set('ownerId', e.target.value || undefined)}><option value="">—</option>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
              <Field label="Trạng thái thủ công" hint={content ? 'Đang theo nội dung AI' : undefined}><select className={inputCls} value={f.status} disabled={!!content} onChange={(e) => set('status', e.target.value as TaskStatus)}><option value="PLAN">Kế hoạch</option><option value="PUBLISHED">Đã đăng (làm ngoài hệ thống)</option></select></Field>
            </div>
          </FormCard>
          {!plat && (
            <FormCard title="Yêu cầu cho AI (kênh này soạn tự do)">
              <Field label="Yêu cầu nội dung"><textarea className={cn(inputCls, 'min-h-[72px]')} value={f.textPrompt} onChange={(e) => set('textPrompt', e.target.value)} placeholder="Đối tượng, thông điệp, ưu đãi, độ dài…" /></Field>
              <Field label="Yêu cầu hình ảnh" className="mt-3"><textarea className={cn(inputCls, 'min-h-[56px]')} value={f.imagePrompt} onChange={(e) => set('imagePrompt', e.target.value)} placeholder="Phong cách, bối cảnh, màu sắc…" /></Field>
            </FormCard>
          )}
          {plat && <p className="text-xs text-[rgb(var(--muted))]">Tiếp theo: tab <b>Cấu hình nội dung</b> chọn mẫu nhanh và từ khóa, tab <b>Cấu hình hình ảnh</b> chọn khung hình, bối cảnh.</p>}
          {content && (
            <FormCard title="Nội dung AI">
              <p className="font-medium">{content.title}</p>
              <p className="text-xs text-[rgb(var(--muted))]">{content.blocks?.length ?? 0} mục · {content.blocks?.filter((b) => b.image).length ?? 0} ảnh · {CONTENT_STATUS[content.status].label}{content.aiJob?.status === 'FAILED' ? ` · lỗi: ${content.aiJob.error}` : ''}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {content.status !== 'DRAFT' && <button type="button" className={cn(btnPrimary, btnSm)} onClick={() => { onClose(); openContentReview(content.id); }}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />{content.status === 'REVIEW' && canDo('mkt.manage') ? 'Xem & duyệt' : 'Xem bài'}</button>}
                <button type="button" className={cn(btnGhost, btnSm)} onClick={openStudio}><ExternalLink className="h-3.5 w-3.5" aria-hidden />Mở Workspace</button>
              </div>
            </FormCard>
          )}
        </>}
        {tab === 'content' && plat && pid && (
          <VariantPicker kind="text" platform={pid} values={sv} title={f.title} context={f.textPrompt} ro={ro} onChange={setSv}
            middle={<ChannelSettingsCard platformId={pid} title={f.title} note={f.textPrompt} settings={sv} onChange={setSv} ro={ro} self={{ taskId: f.id, contentId: live.contentId }} />}
            advancedExtra={<div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">{ST_BRIEF_FIELDS.map((x) => <StFieldControl key={x.key} f={x} value={sv[x.key]} company={stCo} onChange={(v) => setSv({ ...sv, [x.key]: v })} />)}</div>
              <Field label="Ghi chú thêm cho AI"><textarea className={cn(inputCls, 'min-h-[64px]')} value={f.textPrompt} onChange={(e) => set('textPrompt', e.target.value)} placeholder="Góc nhìn, ví dụ thực tế, công trình đã làm…" /></Field>
            </div>} />
        )}
        {tab === 'image' && plat && pid && (
          <VariantPicker kind="image" platform={pid} values={sv} title={f.title} context={f.imagePrompt} ro={ro} onChange={setSv}
            advancedExtra={<Field label="Ghi chú thêm cho ảnh"><textarea className={cn(inputCls, 'min-h-[56px]')} value={f.imagePrompt} onChange={(e) => set('imagePrompt', e.target.value)} placeholder="Nhân vật, góc chụp, chi tiết cần có…" /></Field>} />
        )}
        {tab !== 'general' && !plat && <p className="rounded-md bg-[rgb(var(--sunken))] p-3 text-sm text-[rgb(var(--muted))]">Kênh {MKT_CH[f.channel].label} soạn tự do: nhập yêu cầu ở tab Thông tin chung.</p>}
      </fieldset>
    </SideSheet>
  );
}

// ---------- Chiến dịch (tab Plan) ----------

export function CampaignSheet({ c, onClose }: { c: Campaign | null; onClose: () => void }) {
  const { campaigns, setCampaigns, audiences, users, canDo, notify, me, setMktTasks, company } = useApp();
  const assign = useAssignToAi();
  const stCo = useMemo(() => stCompanyOf(company), [company]);
  const [tab, setTab] = useState<'info' | 'goal' | 'ai'>('info');
  const [f, setF] = useState<Campaign>(() => c ?? { id: uid('cp'), code: `CD-${new Date().getFullYear()}-${String(campaigns.length + 1).padStart(3, '0')}`, name: '', channels: ['FACEBOOK'], start: todayISO(), end: isoDay(Date.now() + 30 * dayMs), budget: 0, spent: 0, status: 'PLANNED', ownerId: me?.id, createdAt: Date.now() });
  const set = <K extends keyof Campaign>(k: K, v: Campaign[K]) => setF((p) => ({ ...p, [k]: v }));
  const ro = !canDo('mkt.manage');
  const aiCh: MktChannel = f.aiChannel && f.channels.includes(f.aiChannel) ? f.aiChannel : f.channels.find((x) => ST_OF_CHANNEL[x]) ?? f.channels[0] ?? 'FACEBOOK';
  const pid = ST_OF_CHANNEL[aiCh];
  const sv: StSettings = pid ? { ...getPlatform(pid).defaults(stCo), ...(f.settings ?? {}) } : (f.settings ?? {});
  const setSv = (next: StSettings) => setF((p) => ({ ...p, settings: next }));
  const errs = pid ? getPlatform(pid).validate(sv) : [];
  const save = () => { setCampaigns((p) => (p.some((x) => x.id === f.id) ? p.map((x) => (x.id === f.id ? f : x)) : [f, ...p])); notify(`Đã lưu chiến dịch ${f.name}`, 'teal'); onClose(); };
  const toAi = () => {
    setCampaigns((p) => (p.some((x) => x.id === f.id) ? p.map((x) => (x.id === f.id ? f : x)) : [f, ...p]));
    const t: MktTask = { id: uid('tk'), date: f.start, title: f.name, campaignId: f.id, channel: aiCh, contentType: aiCh === 'ZNS' || aiCh === 'SMS' ? 'ZNS' : aiCh === 'ZALO_OA' ? 'ZALO_OA' : f.channels.includes('EVENT') ? 'PRESS' : 'AD_POST', textPrompt: [f.goal, f.textPrompt].filter(Boolean).join('\n'), imagePrompt: f.imagePrompt ?? '', status: 'PLAN', ownerId: f.ownerId ?? me?.id, createdAt: Date.now(), ...(pid ? { platform: pid, settings: sv } : {}) };
    setMktTasks((p) => [t, ...p]);
    assign(t);
    onClose();
  };
  const cpl = f.targetLeads ? f.budget / f.targetLeads : 0;
  const days = Math.max(1, Math.round((Date.parse(f.end) - Date.parse(f.start)) / dayMs) + 1);
  return (
    <SideSheet title={c ? 'Sửa chiến dịch' : 'Chiến dịch mới'} sub={f.code} onClose={onClose} width="sm:w-[600px]"
      footer={<>
        {c && !ro && <button className={cn(btnGhost, 'mr-auto text-[rgb(var(--danger-fg))]')} onClick={() => { setCampaigns((p) => p.filter((x) => x.id !== f.id)); notify('Đã xóa chiến dịch', 'orange'); onClose(); }}>Xóa</button>}
        <button className={btnGhost} onClick={onClose}>Đóng</button>
        {!ro && <button className={btnPrimary} disabled={!f.name.trim() || !f.channels.length || f.end < f.start} onClick={save}>Lưu</button>}
        {!ro && <button className={btnAccent} disabled={!f.name.trim() || !f.channels.length || f.end < f.start || errs.length > 0} title={errs.length ? `Tab Nội dung AI cần: ${errs.join(', ')}` : undefined} onClick={toAi}><Sparkles className="h-4 w-4" aria-hidden />Giao cho AI</button>}
      </>}>
      <SheetTabs value={tab} onChange={setTab} tabs={[{ id: 'info', label: 'Thông tin chung', dot: !f.name.trim() || f.end < f.start }, { id: 'goal', label: 'Mục tiêu & ngân sách' }, { id: 'ai', label: 'Nội dung AI', dot: errs.length > 0 }]} />
      <fieldset disabled={ro} className="min-w-0 space-y-3">
        {tab === 'info' && <>
          <FormCard>
            <Field label="Tên chiến dịch"><input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="VD: Tri ân đại lý quý 4" /></Field>
            <div className="mt-3"><p className="mb-1 text-xs font-medium text-[rgb(var(--muted))]">Kênh</p>
              <SelectMenu ariaLabel="Kênh" multi value={f.channels} onChange={(v) => set('channels', v as MktChannel[])} disabled={ro} options={(Object.keys(MKT_CH) as MktChannel[]).map((k) => ({ id: k, label: MKT_CH[k].label }))} placeholder="Chọn kênh…" /></div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Bắt đầu"><input type="date" className={inputCls} value={f.start} onChange={(e) => set('start', e.target.value)} /></Field>
              <Field label="Kết thúc" error={f.end < f.start ? 'Trước ngày bắt đầu' : undefined}><input type="date" className={inputCls} value={f.end} onChange={(e) => set('end', e.target.value)} /></Field>
              <Field label="Phụ trách"><select className={inputCls} value={f.ownerId ?? ''} onChange={(e) => set('ownerId', e.target.value || undefined)}><option value="">—</option>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
              <Field label="Phân khúc mục tiêu"><select className={inputCls} value={f.audienceId ?? ''} onChange={(e) => set('audienceId', e.target.value || undefined)}><option value="">Không chọn</option>{audiences.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
            </div>
            <div className="mt-3"><p className="mb-1 text-xs font-medium text-[rgb(var(--muted))]">Trạng thái</p><Segmented ariaLabel="Trạng thái" disabled={ro} value={f.status} onChange={(v) => set('status', v as CampaignStatus)} options={(Object.keys(CAMP_STATUS) as CampaignStatus[]).map((s) => ({ id: s, label: CAMP_STATUS[s].label }))} /></div>
          </FormCard>
          <FormCard><Field label="Mục tiêu / thông điệp chính"><textarea className={cn(inputCls, 'min-h-[64px]')} value={f.goal ?? ''} onChange={(e) => set('goal', e.target.value)} placeholder="VD: Tăng 30% đơn băng keo VHB từ đại lý miền Bắc" /></Field></FormCard>
        </>}
        {tab === 'goal' && <>
          <FormCard title="Ngân sách">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ngân sách (đ)"><MoneyInput value={f.budget} onChange={(v) => set('budget', v)} /></Field>
              <Field label="Đã chi (đ)"><MoneyInput value={f.spent} onChange={(v) => set('spent', v)} /></Field>
            </div>
            {f.budget > 0 && <div className="mt-3"><div className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--ink)/0.08)]"><div className="h-full rounded-full bg-[rgb(var(--accent))]" style={{ width: `${Math.min(100, (f.spent / f.budget) * 100)}%` }} /></div><p className="mt-1 text-xs text-[rgb(var(--muted))]">Đã chi {Math.round((f.spent / f.budget) * 100)}% · bình quân {compact(f.budget / days)}/ngày trong {days} ngày</p></div>}
          </FormCard>
          <FormCard title="Mục tiêu">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mục tiêu lead"><input type="number" min={0} className={inputCls} value={f.targetLeads ?? ''} onChange={(e) => set('targetLeads', Number(e.target.value) || undefined)} /></Field>
              <div className="rounded-md bg-[rgb(var(--surface))] p-2.5 text-xs"><p className="text-[rgb(var(--muted))]">Chi phí / lead mục tiêu</p><p className="mt-0.5 text-lg font-semibold tabular-nums">{cpl ? compact(cpl) : '—'}</p></div>
              <Field label="Lead ngoài hệ thống" hint="Sự kiện, phiếu đăng ký giấy…"><input type="number" min={0} className={inputCls} value={f.manualLeads ?? ''} onChange={(e) => set('manualLeads', Number(e.target.value) || undefined)} /></Field>
              <Field label="Doanh thu ngoài hệ thống (đ)"><MoneyInput value={f.manualRevenue ?? 0} onChange={(v) => set('manualRevenue', v || undefined)} /></Field>
            </div>
          </FormCard>
        </>}
        {tab === 'ai' && <>
          <FormCard>
            <p className="mb-1 text-xs font-medium text-[rgb(var(--muted))]">Kênh AI soạn bài đầu tiên</p>
            <SelectMenu ariaLabel="Kênh AI soạn" value={[aiCh]} disabled={ro} onChange={(v) => set('aiChannel', v[0] as MktChannel)} options={f.channels.map((k) => ({ id: k, label: MKT_CH[k].label, hint: ST_OF_CHANNEL[k] ? 'Soạn theo thông số kênh' : 'Soạn tự do' }))} />
            <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">"Giao cho AI" tạo nhiệm vụ vào ngày bắt đầu trên Plan; AI soạn bài và ảnh, xong chuyển Chờ duyệt.</p>
          </FormCard>
          {pid
            ? <VariantPicker kind="text" platform={pid} values={sv} title={f.name} context={f.goal} ro={ro} onChange={setSv}
                middle={<ChannelSettingsCard platformId={pid} title={f.name} note={f.goal ?? ''} settings={sv} onChange={setSv} ro={ro} self={{}} />}
                advancedExtra={<Field label="Ghi chú thêm cho AI"><textarea className={cn(inputCls, 'min-h-[56px]')} value={f.textPrompt ?? ''} onChange={(e) => set('textPrompt', e.target.value)} /></Field>} />
            : <FormCard><Field label="Yêu cầu nội dung"><textarea className={cn(inputCls, 'min-h-[64px]')} value={f.textPrompt ?? ''} onChange={(e) => set('textPrompt', e.target.value)} placeholder="Thông điệp, ưu đãi, đối tượng…" /></Field></FormCard>}
          {pid && <VariantPicker kind="image" platform={pid} values={sv} title={f.name} ro={ro} onChange={setSv} advancedExtra={<Field label="Ghi chú thêm cho ảnh"><textarea className={cn(inputCls, 'min-h-[52px]')} value={f.imagePrompt ?? ''} onChange={(e) => set('imagePrompt', e.target.value)} /></Field>} />}
        </>}
      </fieldset>
    </SideSheet>
  );
}

// ---------- Automation: kịch bản tự động + phân khúc (phân khúc dùng làm điều kiện kích hoạt) ----------

export function AutomationHub() {
  const [sub, setSub] = useSticky<'flows' | 'segments'>('Mkt.autoSub', 'flows');
  return (
    <div className="space-y-3">
      <div className="max-w-md"><Segmented ariaLabel="Automation" value={sub} onChange={(v) => setSub(v as 'flows' | 'segments')} options={[{ id: 'flows', label: 'Kịch bản tự động' }, { id: 'segments', label: 'Phân khúc khách hàng' }]} /></div>
      {sub === 'flows' ? <AutomationList /> : <AudienceBuilder />}
    </div>
  );
}

/** Cắt giữa + đổi kích thước đúng W×H, mã hóa lại (xóa EXIF / vị trí GPS của ảnh gốc) */
export function fitImage(dataUrl: string, w: number, h: number, type: 'image/webp' | 'image/jpeg', q: number): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d')!;
      const k = Math.max(w / img.width, h / img.height);
      const sw = w / k, sh = h / k;
      g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
      const out = c.toDataURL(type, q);
      res(type === 'image/webp' && !out.startsWith('data:image/webp') ? c.toDataURL('image/jpeg', q) : out);
    };
    img.onerror = () => rej(new Error('Ảnh không hợp lệ'));
    img.src = dataUrl;
  });
}

export function ImageStudioTab() {
  const [sub, setSub] = useSticky<'ai' | 'library' | 'banner'>('Mkt.imgSub', 'ai');
  const { mktImages } = useApp();
  return (
    <div className="space-y-3">
      <div className="max-w-lg"><Segmented ariaLabel="Image" value={sub} onChange={(v) => setSub(v as 'ai' | 'library' | 'banner')} options={[{ id: 'ai', label: 'Tạo ảnh AI' }, { id: 'library', label: `Thư viện ảnh (${mktImages.length})` }, { id: 'banner', label: 'Thiết kế banner' }]} /></div>
      {sub === 'ai' && <ImageGeneratorPanel onSaved={() => undefined} />}
      {sub === 'library' && <ImageLibrary />}
      {sub === 'banner' && <BannerStudio />}
    </div>
  );
}

export function ImageGeneratorPanel({ onSaved }: { onSaved: () => void }) {
  const { company, skus, canDo, notify, setMktImages, me, hubCfg } = useApp();
  const api = useStudioPort();
  const co = useMemo(() => stCompanyOf(company), [company]);
  const ro = !canDo('mkt.manage');
  const cfg = vCfgOf(hubCfg.content);
  const [topic, setTopic] = useState('');
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<string>('blog');
  const [cw, setCw] = useState(1200); const [ch, setCh] = useState(800);
  const [vals, setVals] = useState<StSettings>({});
  const [refs, setRefs] = useState<string[]>([]);
  const [skuRefs, setSkuRefs] = useState<string[]>([]);
  const [strength, setStrength] = useState(0.35);
  const [count, setCount] = useState('1');
  const [kw, setKw] = useState('');
  const [alt, setAlt] = useState('');
  const [caption, setCaption] = useState('');
  const [titleAttr, setTitleAttr] = useState('');
  const [fileBase, setFileBase] = useState('');
  const [stamp, setStamp] = useState('logo');
  const [fmt, setFmt] = useState('webp');
  const [quality, setQuality] = useState(0.85);
  const [busy, setBusy] = useState<'' | 'img' | 'prompt' | 'alt'>('');
  const [results, setResults] = useState<{ url: string; w: number; h: number; kb: number; model: string }[]>([]);
  const [err, setErr] = useState('');
  const sz = IMG_SIZES.find((x) => x.id === size) ?? IMG_SIZES[5];
  const W = sz.id === 'custom' ? Math.max(200, Math.min(4096, cw)) : sz.w, H = sz.id === 'custom' ? Math.max(200, Math.min(4096, ch)) : sz.h;
  const aspect: 'landscape' | 'square' | 'portrait' = W / H > 1.15 ? 'landscape' : W / H < 0.87 ? 'portrait' : 'square';
  const groups = vGroups(cfg, undefined, 'image').filter((g) => ['imgScene', 'imgStyle', 'imgColor'].includes(g.id));
  const refImages = [...refs, ...skuRefs.map((id) => skus.find((x) => x.sku === id)?.image).filter((u): u is string => !!u && u.startsWith('data:'))];
  const base = slugify(fileBase || kw || topic) || 'anh';
  const ext = fmt === 'webp' ? 'webp' : 'jpg';
  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const list = [...files].filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type)).slice(0, 3 - refs.length);
    const urls = await Promise.all(list.map((f) => stShrinkImage(f, 1280).catch(() => '')));
    setRefs((p) => [...p, ...urls.filter(Boolean)].slice(0, 3));
  };
  const writePrompt = async () => {
    setBusy('prompt'); setErr('');
    try {
      const t = await api.text({ system: 'Bạn viết mô tả ảnh (prompt) cho mô hình tạo ảnh, tiếng Việt, 1 đoạn ≤ 70 từ, cụ thể bối cảnh, ánh sáng, góc máy, không chữ trong ảnh. Chỉ trả đoạn mô tả.', prompt: `Chủ đề: ${topic || kw}. Lĩnh vực: ${co.sector}. Yêu cầu: ${vText(vals, undefined, 'image', cfg)}. Khung hình ${W}×${H}.${refImages.length ? ' Có ảnh sản phẩm tham chiếu, giữ đúng hình dáng sản phẩm.' : ''}`, maxTokens: 400 });
      setPrompt(wsCleanAi(t));
    } catch (e) { setErr(e instanceof Error ? e.message : 'AI chưa viết được mô tả'); } finally { setBusy(''); }
  };
  const writeAlt = async () => {
    setBusy('alt'); setErr('');
    try {
      const raw = await api.text({ system: 'Chỉ trả về đúng 1 đối tượng JSON hợp lệ.', prompt: `Viết thông tin SEO cho ảnh: chủ đề "${topic}", từ khóa "${kw || topic}", mô tả ảnh: ${prompt.slice(0, 500)}. Trả JSON {"alt":"≤ 125 ký tự, mô tả đúng ảnh, tự nhiên chứa từ khóa","caption":"1 câu ≤ 140 ký tự","title":"≤ 60 ký tự","file":"ten-file-khong-dau"}`, maxTokens: 600 });
      const j = parseAiJson<{ alt?: string; caption?: string; title?: string; file?: string }>(raw);
      if (!j) throw new Error('AI trả sai định dạng');
      if (j.alt) setAlt(stClip(j.alt, 125)); if (j.caption) setCaption(stClip(j.caption, 160)); if (j.title) setTitleAttr(stClip(j.title, 60)); if (j.file && !fileBase) setFileBase(slugify(j.file));
    } catch (e) { setErr(e instanceof Error ? e.message : 'AI chưa trả lời'); } finally { setBusy(''); }
  };
  const generate = async () => {
    const p = [prompt.trim() || `Ảnh minh họa cho "${topic || kw}"`, vText(vals, undefined, 'image', cfg)].filter(Boolean).join(', ');
    if (p.length < 8) { setErr('Nhập chủ đề hoặc mô tả ảnh'); return; }
    setBusy('img'); setErr('');
    const n = Number(count) || 1;
    const out: typeof results = [];
    try {
      for (let i = 0; i < n; i++) {
        const brand = vImg(vals, 'imgColor') !== 'natural';
        const r = await api.image({ prompt: brand ? `${p}\n${ST_BRAND.palettePrompt}${n > 1 ? `\nPhương án ${i + 1}: khác góc máy / bố cục.` : ''}` : p, aspect, reference: refImages[i % Math.max(1, refImages.length)], strength, brandPalette: brand });
        const marked = stamp === 'none' ? r.dataUrl : await applyWatermark(r.dataUrl, co.name, stamp === 'logo' ? company.logo : undefined).catch(() => r.dataUrl);
        const url = await fitImage(marked, W, H, fmt === 'webp' ? 'image/webp' : 'image/jpeg', quality);
        out.push({ url, w: W, h: H, kb: dataKb(url), model: r.model });
        setResults([...out]);
      }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Không tạo được ảnh'); } finally { setBusy(''); }
  };
  const saveImg = (r: (typeof results)[number], i: number) => {
    const img: MktImage = { id: uid('mi'), url: r.url, w: r.w, h: r.h, kb: r.kb, fileName: `${base}${results.length > 1 ? `-${i + 1}` : ''}.${ext}`, alt: alt.trim() || stClip(topic || kw, 125), caption: caption.trim(), title: titleAttr.trim(), keyword: kw.trim(), prompt, size: sz.label, refSku: skuRefs[0], createdAt: Date.now(), by: me?.id };
    setMktImages((p) => [img, ...p].slice(0, MKT_IMG_MAX));
    notify(`Đã lưu ${img.fileName} vào thư viện`, 'teal'); onSaved();
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[440px_1fr]">
      <fieldset disabled={ro} className="min-w-0 space-y-3">
        <FormCard title="Ảnh tham chiếu" aside={<span className="text-[11px] text-[rgb(var(--muted))]">AI bám theo hình sản phẩm thật</span>}>
          <div className="flex flex-wrap gap-2">
            {refs.map((u, i) => <div key={i} className="relative"><img src={u} alt={`Ảnh tham chiếu ${i + 1}`} className="h-16 w-16 rounded-md object-cover" /><button type="button" aria-label="Bỏ ảnh" className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-[rgb(var(--danger))] text-xs text-white" onClick={() => setRefs((p) => p.filter((_, k) => k !== i))}>×</button></div>)}
            {refs.length < 3 && <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-[rgb(var(--line))] text-[10px] text-[rgb(var(--muted))] hover:border-[rgb(var(--accent))]" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void addFiles(e.dataTransfer.files); }}><Upload className="h-4 w-4" aria-hidden />Tải ảnh<input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void addFiles(e.target.files)} /></label>}
          </div>
          <div className="mt-3"><SelectMenu ariaLabel="Ảnh sản phẩm trong danh mục" multi value={skuRefs} onChange={(v) => setSkuRefs(v.slice(-2))} placeholder="Hoặc chọn ảnh sản phẩm trong danh mục…" options={skus.filter((x) => x.image && !x.archived).slice(0, 200).map((x) => ({ id: x.sku, label: x.sku, hint: x.name, img: x.image }))} /></div>
          {refImages.length > 0 && <div className="mt-3"><div className="flex justify-between text-xs"><span className="text-[rgb(var(--muted))]">Bám ảnh gốc</span><span className="tabular-nums">{strength.toFixed(2)}</span><span className="text-[rgb(var(--muted))]">Sáng tạo tự do</span></div><input type="range" min={0} max={1} step={0.05} value={strength} onChange={(e) => setStrength(Number(e.target.value))} className="w-full accent-[rgb(var(--accent))]" aria-label="Mức bám ảnh gốc" /><p className="text-[11px] text-[rgb(var(--faint))]">Nhiều phương án sẽ lần lượt dùng từng ảnh tham chiếu.</p></div>}
        </FormCard>
        <FormCard title="Nội dung ảnh">
          <Field label="Chủ đề"><input className={inputCls} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="VD: Băng keo VHB dán mặt dựng kính" /></Field>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between"><span className="text-xs font-medium text-[rgb(var(--muted))]">Mô tả ảnh cho AI</span><AiSpark title="AI viết mô tả từ chủ đề và lựa chọn bên dưới" busy={busy === 'prompt'} disabled={!(topic || kw).trim()} onClick={() => void writePrompt()} /></div>
            <textarea className={cn(inputCls, 'min-h-[72px] text-sm')} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Để trống: AI dùng chủ đề + các lựa chọn bên dưới" aria-label="Mô tả ảnh" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="col-span-2"><p className="mb-1 text-xs font-medium text-[rgb(var(--muted))]">Kích thước</p><SelectMenu ariaLabel="Kích thước" value={[size]} onChange={(v) => setSize(v[0])} options={IMG_SIZES.map((x) => ({ id: x.id, label: x.label, hint: x.w ? `${x.w}×${x.h} px` : 'Tự nhập rộng × cao' }))} /></div>
            {size === 'custom' && <><Field label="Rộng (px)"><input type="number" min={200} max={4096} className={inputCls} value={cw} onChange={(e) => setCw(Number(e.target.value) || 0)} /></Field><Field label="Cao (px)"><input type="number" min={200} max={4096} className={inputCls} value={ch} onChange={(e) => setCh(Number(e.target.value) || 0)} /></Field></>}
            {groups.map((g) => <VariantControl key={g.id} g={g} values={vals} cfg={cfg} onChange={setVals} />)}
            <div className="col-span-2"><p className="mb-1 text-xs font-medium text-[rgb(var(--muted))]">Số phương án</p><Segmented ariaLabel="Số phương án" value={count} onChange={setCount} options={[{ id: '1', label: '1 ảnh' }, { id: '2', label: '2 ảnh' }, { id: '3', label: '3 ảnh' }]} /></div>
          </div>
        </FormCard>
        <FormCard title="SEO ảnh" aside={<AiSpark title="AI viết alt, chú thích, title, tên file" busy={busy === 'alt'} disabled={!(topic || kw || prompt).trim()} onClick={() => void writeAlt()} />}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Từ khóa chính"><input className={inputCls} value={kw} onChange={(e) => setKw(e.target.value)} placeholder="VD: băng keo VHB" /></Field>
            <Field label="Tên file"><input className={cn(inputCls, 'font-mono text-xs')} value={fileBase} onChange={(e) => setFileBase(slugify(e.target.value))} placeholder={base} /></Field>
            <Field label={`Alt text (${alt.length}/125)`} className="col-span-2"><input className={inputCls} maxLength={125} value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Mô tả đúng nội dung ảnh, có từ khóa" /></Field>
            <Field label="Chú thích (caption)" className="col-span-2"><input className={inputCls} value={caption} onChange={(e) => setCaption(e.target.value)} /></Field>
            <Field label="Title" className="col-span-2"><input className={inputCls} maxLength={60} value={titleAttr} onChange={(e) => setTitleAttr(e.target.value)} /></Field>
            <div><p className="mb-1 text-xs font-medium text-[rgb(var(--muted))]">Đóng dấu</p><Segmented ariaLabel="Đóng dấu" value={stamp} onChange={setStamp} options={[{ id: 'logo', label: 'Logo' }, { id: 'name', label: 'Tên' }, { id: 'none', label: 'Không' }]} /></div>
            <div><p className="mb-1 text-xs font-medium text-[rgb(var(--muted))]">Định dạng</p><Segmented ariaLabel="Định dạng" value={fmt} onChange={setFmt} options={[{ id: 'webp', label: 'WebP' }, { id: 'jpeg', label: 'JPEG' }]} /></div>
            <div className="col-span-2"><div className="flex justify-between text-xs text-[rgb(var(--muted))]"><span>Chất lượng nén</span><span className="tabular-nums">{Math.round(quality * 100)}%</span></div><input type="range" min={0.6} max={0.95} step={0.05} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-[rgb(var(--accent))]" aria-label="Chất lượng nén" /></div>
          </div>
          <p className="mt-2 text-[11px] text-[rgb(var(--faint))]">Ảnh xuất được cắt đúng {W}×{H}, nén lại và xóa thông tin EXIF / vị trí GPS của ảnh gốc. Nên giữ dưới 200 KB.</p>
        </FormCard>
        <div className="sticky bottom-0 z-10 -mx-1 bg-[rgb(var(--bg)/0.92)] px-1 py-2 backdrop-blur">
          <button type="button" className={cn(btnAccent, 'w-full justify-center')} disabled={!!busy} onClick={() => void generate()}><Sparkles className="h-4 w-4" aria-hidden />{busy === 'img' ? `Đang tạo ${results.length + 1}/${count}…` : `Tạo ${count} ảnh ${W}×${H}`}</button>
          {err && <p className="mt-1 text-xs text-[rgb(var(--danger-fg))]" role="alert">{err}</p>}
        </div>
      </fieldset>
      <section className="min-w-0 space-y-3" aria-label="Kết quả">
        {!results.length && <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-[rgb(var(--line))] text-center text-sm text-[rgb(var(--muted))]"><ImagePlus className="mb-2 h-6 w-6" aria-hidden />Ảnh tạo ra hiện ở đây, đúng kích thước đã chọn.<span className="text-xs">Tải về với tên file chuẩn SEO hoặc lưu vào thư viện để chèn vào bài.</span></div>}
        <div className="grid gap-3 sm:grid-cols-2">
          {results.map((r, i) => (
            <figure key={i} className="overflow-hidden rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))]">
              <img src={r.url} alt={alt || topic} className="w-full object-contain" style={{ aspectRatio: `${r.w} / ${r.h}` }} />
              <figcaption className="space-y-2 p-3 text-xs">
                <p className="flex flex-wrap gap-x-2 text-[rgb(var(--muted))]"><span className="font-mono">{base}{results.length > 1 ? `-${i + 1}` : ''}.{ext}</span><span>{r.w}×{r.h}</span><span className={r.kb > 300 ? 'text-[rgb(var(--danger-fg))]' : ''}>{r.kb} KB</span><span>{r.model}</span></p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={cn(btnGhost, btnSm)} onClick={() => downloadData(r.url, `${base}${results.length > 1 ? `-${i + 1}` : ''}.${ext}`)}><Download className="h-3.5 w-3.5" aria-hidden />Tải về</button>
                  {!ro && <button type="button" className={cn(btnPrimary, btnSm)} onClick={() => saveImg(r, i)}>Lưu vào thư viện</button>}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ImageLibrary({ onPick }: { onPick?: (img: MktImage) => void }) {
  const { mktImages, setMktImages, canDo, notify, userName } = useApp();
  const [q, setQ] = useState('');
  const list = mktImages.filter((x) => !q || stFold(`${x.fileName} ${x.alt} ${x.keyword} ${x.caption}`).includes(stFold(q)));
  return (
    <section className={cn('space-y-3', !onPick && 'glass-card rounded-md p-5')}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[rgb(var(--muted))]" aria-hidden /><input className={cn(inputCls, 'pl-8')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên file, alt, từ khóa…" aria-label="Tìm ảnh" /></div>
        <span className="text-xs text-[rgb(var(--muted))]">{mktImages.length}/{MKT_IMG_MAX} ảnh</span>
      </div>
      {!list.length && <p className="py-8 text-center text-sm text-[rgb(var(--muted))]">{mktImages.length ? 'Không có ảnh khớp' : 'Chưa có ảnh. Tạo ở "Tạo ảnh AI" rồi bấm Lưu vào thư viện.'}</p>}
      <div className={cn('grid gap-3', onPick ? 'grid-cols-3' : 'sm:grid-cols-3 xl:grid-cols-4')}>
        {list.map((x) => (
          <figure key={x.id} className="overflow-hidden rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))]">
            <button type="button" className="block w-full" onClick={() => onPick?.(x)} disabled={!onPick} aria-label={onPick ? `Chọn ${x.fileName}` : undefined}><img src={x.url} alt={x.alt} className="aspect-[4/3] w-full object-cover" /></button>
            <figcaption className="space-y-1 p-2 text-[11px]">
              <p className="truncate font-mono">{x.fileName}</p>
              <p className="line-clamp-2 text-[rgb(var(--muted))]" title={x.alt}>{x.alt || <i>Thiếu alt</i>}</p>
              {!onPick && <>
                <p className="text-[rgb(var(--faint))]">{x.w}×{x.h} · {x.kb} KB{x.by ? ` · ${userName(x.by)}` : ''}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button type="button" className={cn(btnGhost, btnSm)} onClick={() => downloadData(x.url, x.fileName)}><Download className="h-3 w-3" aria-hidden />Tải</button>
                  <button type="button" className={cn(btnGhost, btnSm)} onClick={() => { void navigator.clipboard?.writeText(x.alt).then(() => notify('Đã chép alt', 'teal')); }}><Copy className="h-3 w-3" aria-hidden />Alt</button>
                  {canDo('mkt.manage') && <button type="button" className={cn(btnGhost, btnSm, 'text-[rgb(var(--danger-fg))]')} onClick={() => setMktImages((p) => p.filter((y) => y.id !== x.id))} aria-label={`Xóa ${x.fileName}`}><Trash2 className="h-3 w-3" aria-hidden /></button>}
                </div>
              </>}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

// ---------- v38.7: thao tác Sửa / Nhân bản / Xuất / Xóa cho nhiệm vụ, nội dung, chiến dịch ----------

/** Xuất một nội dung đúng như bản đăng theo kênh: Word (.doc), PDF (in), HTML, hoặc sao chép */
export function useContentExport() {
  const { company, notify } = useApp();
  const co = useMemo(() => stCompanyOf(company), [company]);
  const build = (c: MktContent) => {
    const art0 = contentToArticle(c, co);
    const art = { ...art0, doc: art0.doc ?? wsArticleToDoc(art0) };
    const out = getPlatform(art.platform).render(art, co);
    const html = out.format === 'html' ? out.body : out.body.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n');
    const head = out.format === 'html' && /<h1/i.test(out.body) ? '' : `<h1>${esc(c.title)}</h1>`;
    return { out, html: head + html, file: slugify(stStr(art.settings.slug) || c.title) || 'noi-dung' };
  };
  return (c: MktContent, fmt: 'word' | 'pdf' | 'html' | 'copy') => {
    const { out, html, file } = build(c);
    if (fmt === 'word') downloadWord(file, c.title, html);
    else if (fmt === 'pdf') printHtml(docShell(c.title, html));
    else if (fmt === 'html') downloadBlob(`${file}.html`, new Blob([docShell(c.title, html)], { type: 'text/html;charset=utf-8' }));
    else void navigator.clipboard?.writeText(out.body).then(() => notify(out.format === 'html' ? 'Đã sao chép HTML bài viết' : 'Đã sao chép nội dung', 'teal'), () => notify('Trình duyệt chặn sao chép', 'orange'));
  };
}

/** Menu thao tác của một dòng nội dung (tab Content) */
export function ContentRowMenu({ c, onOpen, onConfirm }: { c: MktContent; onOpen: () => void; onConfirm: (s: ConfirmState) => void }) {
  const { setContents, mktTasks, canDo, notify, me } = useApp();
  const ex = useContentExport();
  const can = canDo('mkt.manage');
  const task = mktTasks.find((t) => t.contentId === c.id);
  return (
    <RowMenu label={`Thao tác: ${c.title}`} items={[
      { label: can ? 'Mở / sửa' : 'Mở', icon: Pencil, onClick: onOpen },
      ...(c.status !== 'DRAFT' ? [{ label: c.status === 'REVIEW' && can ? 'Xem & duyệt' : 'Xem bản đăng', icon: Eye, onClick: () => openContentReview(c.id) }] : []),
      ...(can ? [{ label: 'Nhân bản', icon: Copy, onClick: () => { const n = cloneContent(c, me?.id); setContents((p) => [n, ...p]); notify(`Đã tạo bản sao "${n.title}"`, 'teal'); } }] : []),
      ...contentExportItems(c, ex),
      ...(can ? [{ label: 'Xóa', icon: Trash2, danger: true, onClick: () => onConfirm({
        title: 'Xóa nội dung', confirmLabel: 'Xóa',
        blocked: contentBusy(c) ? 'AI đang soạn bài này, chờ xong rồi xóa.' : undefined,
        message: <>Xóa <b>{c.title || '(chưa có tiêu đề)'}</b>?{task ? <> Nhiệm vụ "{task.title}" trên Plan được giữ lại, chuyển về Kế hoạch.</> : null} Có thể hoàn tác ngay sau khi xóa.</>,
        onConfirm: () => removeWithUndo(setContents, c, notify, `Đã xóa "${c.title}"`),
      }) }] : []),
    ]} />
  );
}

/** Menu thao tác của một nhiệm vụ trên Plan (dạng danh sách) */
export function TaskRowMenu({ t, onEdit, onConfirm }: { t: MktTask; onEdit: () => void; onConfirm: (s: ConfirmState) => void }) {
  const { setMktTasks, contents, canDo, notify, go } = useApp();
  const assign = useAssignToAi();
  const ex = useContentExport();
  const can = canDo('mkt.manage');
  const c = contents.find((x) => x.id === t.contentId);
  const st = taskStatusOf(t, contents);
  return (
    <RowMenu label={`Thao tác: ${t.title}`} items={[
      { label: can ? 'Sửa' : 'Xem', icon: Pencil, onClick: onEdit },
      ...(can && st === 'PLAN' && t.title.trim() ? [{ label: 'Giao cho AI', icon: Sparkles, onClick: () => assign(t) }] : []),
      ...(c && c.status !== 'DRAFT' ? [{ label: c.status === 'REVIEW' && can ? 'Xem & duyệt' : 'Xem bài', icon: Eye, onClick: () => openContentReview(c.id) }] : []),
      ...(c ? [{ label: 'Mở Workspace', icon: ExternalLink, onClick: () => openMktContent(c.id, go) }] : []),
      ...(can ? [{ label: 'Nhân bản', icon: Copy, onClick: () => { setMktTasks((p) => [{ ...t, id: uid('tk'), title: `${t.title} (bản sao)`, contentId: undefined, status: 'PLAN', createdAt: Date.now() }, ...p]); notify('Đã nhân bản nhiệm vụ (chưa giao AI)', 'teal'); } }] : []),
      ...(c ? contentExportItems(c, ex) : []),
      ...(can ? [{ label: 'Xóa', icon: Trash2, danger: true, onClick: () => onConfirm({
        title: 'Xóa nhiệm vụ', confirmLabel: 'Xóa',
        blocked: c && contentBusy(c) ? 'AI đang soạn bài của nhiệm vụ này, chờ xong rồi xóa.' : undefined,
        message: <>Xóa nhiệm vụ <b>{t.title || '(chưa đặt tên)'}</b> ngày {fmtDate(t.date)}?{c ? ' Bài AI đã soạn vẫn giữ ở tab Content.' : ''} Có thể hoàn tác ngay sau khi xóa.</>,
        onConfirm: () => removeWithUndo(setMktTasks, t, notify, `Đã xóa nhiệm vụ "${t.title}"`),
      }) }] : []),
    ]} />
  );
}

/** Menu thao tác của một chiến dịch (tab Budget) */
export function CampaignRowMenu({ c, onEdit, onConfirm }: { c: Campaign; onEdit: () => void; onConfirm: (s: ConfirmState) => void }) {
  const { campaigns, setCampaigns, mktTasks, contents, canDo, notify } = useApp();
  const can = canDo('mkt.manage');
  const nTask = mktTasks.filter((t) => t.campaignId === c.id).length;
  const nContent = contents.filter((x) => x.campaignId === c.id).length;
  return (
    <RowMenu label={`Thao tác: ${c.name}`} items={[
      { label: can ? 'Sửa' : 'Xem', icon: Pencil, onClick: onEdit },
      ...(can ? [{ label: 'Nhân bản', icon: Copy, onClick: () => { setCampaigns((p) => [{ ...c, id: uid('cp'), code: `CD-${new Date().getFullYear()}-${String(campaigns.length + 1).padStart(3, '0')}`, name: `${c.name} (bản sao)`, spent: 0, status: 'PLANNED', manualLeads: undefined, manualRevenue: undefined, createdAt: Date.now() }, ...p]); notify('Đã nhân bản chiến dịch (đã chi về 0)', 'teal'); } }] : []),
      ...(can ? [{ label: 'Xóa', icon: Trash2, danger: true, onClick: () => onConfirm({
        title: 'Xóa chiến dịch', confirmLabel: 'Xóa',
        message: <>Xóa chiến dịch <b>{c.name}</b>?{nTask + nContent ? <> {nTask} nhiệm vụ và {nContent} nội dung đang gắn chiến dịch này được giữ lại, chỉ bỏ liên kết.</> : null} Có thể hoàn tác ngay sau khi xóa.</>,
        onConfirm: () => removeWithUndo(setCampaigns, c, notify, `Đã xóa chiến dịch "${c.name}"`),
      }) }] : []),
    ]} />
  );
}

