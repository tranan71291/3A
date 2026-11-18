'use client';

import { Extension, type AnyExtension, type Editor, type JSONContent } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import TiptapImage from '@tiptap/extension-image';
import StarterKit from '@tiptap/starter-kit';
import { type Node as PMNode } from '@tiptap/pm/model';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Copy, Lock, Sparkles, X } from 'lucide-react';
import { Chip, Field, Panel, useSticky } from '../../components/ui';
import { btnGhost, btnPrimary, btnSm, cloud, CLOUD_ON, countOf, CV_KIND, CV_MAX, GHOST_PREF, ghostEligible, ghostPrefOff, HS_CLICHES_DEFAULT, inputBase, inputCls, maskPii, SeoSidebar, slugify, ST_BRAND, stArr, stEsc, stFold, stHas, stStr, uid, useApp, WS_BLOCK_TYPES, WS_CSS, WS_GHOST, WS_MARKS, WS_TONES, wsClamp, wsCleanAi, wsHeadKey, wsId, wsImages, wsInlineMd, wsPara, wsPushVersion, wsSafeHref, wsSecKey, wsSentences, wsText, wsWords } from '../../lib/core';
import type { AiQuotaCfg, AnyRec, ContentVersion, ContentVersionKind, HumanBlock, HumanReport, StArticle, StCompany, StSection, StudioApi, User, WsBlock, WsDiffPart, WsGhost, WsImagePanel, WsMarks, WsProposal, WsSlash, WsSlashItem, WsTone } from '../../lib/types';
import { cn } from '../../lib/utils';
import { parseAiJson } from '../ai/ai-core';
import { applyWatermark, getPlatform, scoreArticle, stClip, stShrinkImage, useStudio, useStudioActions, useStudioApi } from './content-studio';
import { Switch } from '../platform/console';

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
  const { setDoc, setSapo, setSetting } = useStudioActions();
  const platform = getPlatform(article.platform);
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
    const text = await api.text({ system: `Bạn là biên tập viên nội dung B2B của ${st.company.name}${st.company.sector ? `, lĩnh vực ${st.company.sector}` : ''}. Chỉ trả nội dung mục, không lặp tiêu đề. ${rules}`, prompt: p.sectionPrompt(st.article, headingId, st.company), kind: 'section', article: st.article, sectionId: headingId });
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
export function WsImageCard({ panel, api, article, company, logo, onClose, onInsert }: { panel: NonNullable<WsImagePanel>; api: StudioApi; article: StArticle; company: StCompany; logo?: string; onClose: () => void; onInsert: (attrs: Record<string, string>) => void }) {
  const kw = stStr(article.settings.focusKeyword);
  const n = wsImages(article.doc).length + 1;
  const [src, setSrc] = useState('');
  const [prompt, setPrompt] = useState(`Ảnh minh họa cho "${panel.heading || article.title}", bối cảnh công trình thực tế tại Việt Nam, ảnh chụp chân thực`);
  const [alt, setAlt] = useState(stClip([panel.heading || article.title, kw && !stHas(panel.heading, kw) ? kw : ''].filter(Boolean).join(' – '), 125));
  const [caption, setCaption] = useState('');
  const [fileName, setFileName] = useState(`${slugify(panel.heading || article.title) || 'anh'}-${n}.webp`);
  const [stamp, setStamp] = useState(true);
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
    try { const r = await api.image({ prompt: `${prompt}\n${ST_BRAND.palettePrompt}`, aspect: 'landscape', strength: 0.35, brandPalette: true }); await finish(r.dataUrl); } catch (e) { setErr(e instanceof Error ? e.message : 'Không tạo được ảnh'); } finally { setBusy(''); }
  };
  const suggest = async () => {
    setErr(''); setBusy('text');
    try {
      const raw = await api.text({ system: 'Chỉ trả JSON hợp lệ.', prompt: `Viết alt text (≤ 125 ký tự, mô tả đúng nội dung ảnh, tự nhiên chứa "${kw || panel.heading}") và chú thích ảnh 1 câu (≤ 140 ký tự) cho ảnh trong mục "${panel.heading}" của bài "${article.title}". Đoạn văn quanh ảnh: ${panel.context.slice(0, 900)}\nTrả JSON {"alt":"...","caption":"..."}`, maxTokens: 300 });
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
        </div>
        <div className="space-y-2 text-sm">
          <Field label="Hoặc mô tả để AI tạo ảnh"><div className="flex gap-2"><textarea rows={2} className={cn(inputCls, 'text-xs')} value={prompt} onChange={(e) => setPrompt(e.target.value)} /><button type="button" className={cn(btnGhost, btnSm, 'shrink-0 self-start')} disabled={!!busy} onClick={() => void gen()}>{busy === 'img' ? '…' : 'Tạo ảnh'}</button></div></Field>
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

