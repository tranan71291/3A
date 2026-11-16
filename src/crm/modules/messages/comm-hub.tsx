'use client';

import { ArrowLeft, ExternalLink, Hash, Maximize2, MessageSquare, Search, Send, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { nlScore, useCommandItems } from '../../components/command-palette';
import { MentionComposer, MentionText, useDeepLinks } from '../../components/comments';
import { Avatar } from '../../components/controls';
import { EmptyState, monthly, useSticky } from '../../components/ui';
import { AI_NAME, AI_STARTERS, aiMsgText, bizMode, boqTotal, btnGhost, compact, fold, inputCls, jobCustName, LEAD_STATUS, threadKey, uid, useApp } from '../../lib/core';
import type { AiItem, AiMsg, CommentEntity, Insight, Lead, RowComment, Thread } from '../../lib/types';
import { cn } from '../../lib/utils';
import { buildAiContext, useAi } from '../ai/ai-core';
import { useCopilotExtra } from '../ai/copilot-plus';
import { useMfgData } from '../alux/overview';
import { useInsights } from '../dashboard/overview';
import { ChatFiles } from './messenger';
import { useApprovalQueue } from '../tasks/tasks';

export function useCopilot(): (q: string) => AiMsg {
  const app = useApp();
  const { company, myLeads: leads, myCustomers: customers, users, budget, programs, categories, cashEntries, mfgConfig, canDo, go, openCustomer, openProgramForm, userName, segments, now } = app;
  const { forecast, alerts } = useInsights();
  const { todo } = useApprovalQueue();
  const { rows } = useMfgData();
  const cmds = useCommandItems();
  const mfg = bizMode(company) === 'MFG';
  const t = now ?? Date.now();
  const id = () => uid('ai');
  const has = (q: string, ...k: string[]) => k.some((x) => q.includes(x));
  const openLead = (l: Lead) => () => go(['ACCEPTED', 'QUOTED', 'WON', 'LOST'].includes(l.status) ? 'projects' : 'leads', l.code);
  const toneOf = (a: Insight['tone']): AiItem['tone'] => a;
  const dur = (ms: number) => { const h = Math.abs(ms) / 3.6e6; return h < 24 ? `${Math.max(1, Math.round(h))} giờ` : `${Math.round(h / 24)} ngày`; };

  const sla = (): AiMsg => {
    const open = leads.filter((l) => ['ASSIGNED', 'ACCEPTED', 'QUOTED'].includes(l.status));
    const load = (uidv?: string) => open.filter((l) => l.assignee === uidv).length;
    const risk = open.map((l) => {
      const dl = l.status === 'ASSIGNED' ? l.slaDeadline : l.status === 'ACCEPTED' ? l.quoteDeadline : undefined;
      return { l, dl, kind: l.status === 'ASSIGNED' ? 'tiếp nhận' : 'báo giá' };
    }).filter((x) => x.dl && x.dl - t < (x.kind === 'tiếp nhận' ? 2 : 12) * 3.6e6).sort((a, b) => (a.dl ?? 0) - (b.dl ?? 0));
    const items: AiItem[] = risk.slice(0, 6).map(({ l, dl, kind }) => {
      const peers = users.filter((u) => u.active && u.dept === l.dept && u.role === 'SALES_REP' && u.id !== l.assignee).sort((a, b) => load(a.id) - load(b.id));
      const best = peers[0];
      const mine = load(l.assignee);
      const tip = best && mine > load(best.id) + 1 ? ` Gợi ý chuyển cho ${best.name} (đang ${load(best.id)} việc).` : '';
      return { title: `${l.code} · ${l.company}`, detail: `${dl! < t ? `Quá hạn ${kind} ${dur(t - dl!)}` : `Còn ${dur(dl! - t)} để ${kind}`} · ${userName(l.assignee) || 'chưa giao'} đang ${mine} việc.${tip}`, tone: dl! < t ? 'red' : 'orange', action: { label: 'Mở', run: openLead(l) } };
    });
    const deptAlerts = alerts.filter((a) => a.id.startsWith('sla-') || a.id.startsWith('load-')).map((a) => ({ title: a.title, detail: a.detail, tone: toneOf(a.tone), action: a.go ? { label: a.goLabel ?? 'Xem', run: () => go(a.go!) } : undefined }));
    const done = leads.filter((l) => l.slaMet !== undefined);
    const met = done.filter((l) => l.slaMet).length;
    return {
      id: id(), role: 'ai',
      text: risk.length ? `Có ${risk.length} dự án / lead có nguy cơ trễ SLA (tiếp nhận trong 2 giờ hoặc báo giá trong 12 giờ tới). Ưu tiên xử lý theo thứ tự dưới đây.` : 'Không có dự án nào có nguy cơ trễ SLA trong 12 giờ tới.',
      kpis: [{ label: 'Đúng SLA tiếp nhận', value: done.length ? `${Math.round((met / done.length) * 100)}%` : '—' }, { label: 'Đang xử lý', value: String(open.length) }, { label: 'Nguy cơ trễ', value: String(risk.length), tone: risk.length ? 'red' : 'teal' }],
      items: [...items, ...deptAlerts].slice(0, 8),
      chips: ['Ai đang quá tải việc?', 'Tóm tắt việc cần làm hôm nay'],
      note: `Dựa trên ${open.length} dự án đang mở, hạn SLA và tải việc từng người.`,
    };
  };

  const cash = (): AiMsg => {
    const ins = monthly(cashEntries.filter((e) => e.kind === 'IN'), (e) => e.date, (e) => e.amount, 4);
    const outs = monthly(cashEntries.filter((e) => e.kind === 'OUT'), (e) => e.date, (e) => e.amount, 4);
    const avgIn = (ins[0] + ins[1] + ins[2]) / 3;
    const avgOut = (outs[0] + outs[1] + outs[2]) / 3;
    const balance = mfgConfig.openingCash + mfgConfig.openingBank + cashEntries.reduce((a, e) => a + (e.kind === 'IN' ? e.amount : e.kind === 'OUT' ? -e.amount : 0), 0);
    const receivable = mfg ? rows.filter((r) => r.j.wonAt && !r.j.lostAt).reduce((a, r) => a + r.money.receivable, 0) : customers.reduce((a, c) => a + c.debt, 0);
    const net = avgIn - avgOut;
    const end3 = balance + net * 3;
    const items: AiItem[] = [1, 2, 3].map((k) => {
      const m = forecast.months.find((x) => x.key === `f${k}`);
      const bal = balance + net * k;
      return { title: `${m?.label ?? `Tháng +${k}`}: số dư dự kiến ${compact(bal)}`, detail: `Thu ${compact(avgIn)} – chi ${compact(avgOut)} theo nhịp 3 tháng; doanh số dự báo tháng này ${compact(m?.forecast ?? 0)} (sẽ thành công nợ / tiền về theo điều khoản thanh toán).`, tone: bal < 0 ? 'red' : net < 0 ? 'orange' : 'teal' };
    });
    if (receivable > 0) items.push({ title: `Thu được 50% công nợ hiện tại: +${compact(receivable / 2)}`, detail: 'Kịch bản tích cực nếu đẩy mạnh thu hồi các khoản đến hạn.', tone: 'blue', action: canDo('settings.edit') || true ? { label: 'Xem công nợ', run: () => go('reports') } : undefined });
    return {
      id: id(), role: 'ai',
      text: net >= 0 ? `Dòng tiền ròng bình quân dương ${compact(net)}/tháng. Nếu giữ nhịp này, số dư sau 3 tháng khoảng ${compact(end3)}.` : `Dòng tiền ròng bình quân âm ${compact(-net)}/tháng. Với số dư hiện tại, quỹ đủ dùng khoảng ${balance > 0 ? (balance / -net).toFixed(1).replace('.', ',') : '0'} tháng nếu không thu thêm công nợ.`,
      kpis: [{ label: 'Số dư hiện tại', value: compact(balance) }, { label: 'Phải thu', value: compact(receivable) }, { label: 'Số dư sau 3 tháng', value: compact(end3), tone: end3 < 0 ? 'red' : 'teal' }],
      items, chips: ['Khách nào sắp vượt hạn mức công nợ?', 'Dự báo doanh thu 3 tháng'],
      note: 'Ước tính tuyến tính theo thu chi thực tế 3 tháng gần nhất trong sổ quỹ và công nợ hiện tại; chưa gồm khoản chi bất thường.',
    };
  };

  const fc = (): AiMsg => ({
    id: id(), role: 'ai',
    text: `Dự báo doanh thu 3 tháng tới khoảng ${compact(forecast.next3)} (dao động ${compact(forecast.low3)} – ${compact(forecast.high3)}), độ tin cậy ${forecast.confidence.toLowerCase()}.`,
    kpis: [{ label: 'Tỷ lệ chốt', value: `${Math.round(forecast.winRate * 100)}%` }, { label: 'Chu kỳ chốt', value: `${Math.round(forecast.cycleDays)} ngày` }, { label: 'Cơ hội đang mở', value: String(forecast.openDeals) }],
    items: forecast.months.filter((m) => m.forecast !== undefined).map((m) => ({ title: `${m.label}: ${compact(m.forecast ?? 0)}`, detail: `Từ pipeline có trọng số ${compact(m.pipeline ?? 0)}, phần còn lại ước từ lead mới theo nhịp ${compact(forecast.runRate)}/tháng.`, tone: 'blue' as const })),
    chips: ['Dự báo dòng tiền 3 tháng tới', 'Dự án nào có rủi ro trễ SLA?'],
    note: `Mẫu lịch sử: ${forecast.samples} đơn chốt / trượt. Độ tin cậy tăng khi có thêm dữ liệu.`,
  });

  const mdf = (): AiMsg => {
    if (mfg) return { id: id(), role: 'ai', text: 'Doanh nghiệp này không dùng quỹ MDF của Hãng. Bạn có thể hỏi về dòng tiền, công nợ hoặc rủi ro trễ hẹn.', chips: ['Dự báo dòng tiền 3 tháng tới'] };
    const fy = String(budget.fiscalYear);
    const remaining = Math.max(0, budget.total - budget.spent - budget.committed);
    const used = (code: string) => programs.filter((p) => p.type === code && p.start?.startsWith(fy) && !['REJECTED', 'CANCELLED'].includes(String(p.status))).reduce((a, p) => a + (p.held || p.requested), 0);
    const cats = categories.map((c) => { const alloc = budget.allocations?.[c.code] ?? c.amount; return { c, alloc, u: used(c.code) }; }).filter((x) => x.alloc > 0);
    const under = cats.filter((x) => x.u / x.alloc < 0.3).sort((a, b) => b.alloc - b.u - (a.alloc - a.u));
    const segName = (code: string) => segments.find((x) => x.code === code)?.name ?? code;
    const pick = (seg: string) => {
      const n = fold(segName(seg));
      const want = /dai ly|dealer|phan phoi|cua hang/.test(n) ? ['POSM_SIGNAGE', 'GIFT_DEALER'] : /thau|epc|m&e|co dien/.test(n) ? ['TECH_SEMINAR', 'TECH_TRAINING'] : /chu dau tu|nha may|xuong|end/.test(n) ? ['PROJECT_SAMPLE', 'GIFT_END_USER'] : ['TECH_TRAINING'];
      return cats.find((x) => want.includes(x.c.code) && x.alloc - x.u > 0) ?? under[0];
    };
    const cands = customers.filter((c) => !programs.some((p) => p.customerId === c.id && p.start?.startsWith(fy))).sort((a, b) => (b.ytdRevenue - b.lastYearRevenue * 0.5) - (a.ytdRevenue - a.lastYearRevenue * 0.5)).slice(0, 4);
    const items: AiItem[] = cands.map((c) => {
      const cat = pick(c.segment);
      const amt = Math.min(remaining * 0.1, Math.max(10e6, Math.round((c.ytdRevenue * 0.03) / 1e6) * 1e6));
      return { title: `${c.name}: ${cat ? cat.c.name : 'chương trình phù hợp'} ~${compact(amt)}`, detail: `${segName(c.segment)}, doanh số năm nay ${compact(c.ytdRevenue)} (năm trước ${compact(c.lastYearRevenue)}), chưa nhận quỹ năm ${fy}.`, tone: 'teal', action: canDo('program.create') ? { label: 'Lập đề xuất', run: () => openProgramForm(c.id) } : { label: 'Xem khách', run: () => { go('customers'); openCustomer(c.id); } } };
    });
    under.slice(0, 3).forEach((x) => items.push({ title: `Hạng mục “${x.c.name}” mới dùng ${Math.round((x.u / x.alloc) * 100)}%`, detail: `Còn ${compact(x.alloc - x.u)} trong phân bổ ${compact(x.alloc)}: nên lên lịch chương trình trước khi hết năm tài chính.`, tone: 'blue' }));
    const pace = alerts.find((a) => a.id === 'mdf-fast' || a.id === 'mdf-slow');
    return {
      id: id(), role: 'ai',
      text: `Quỹ 3M còn khả dụng ${compact(remaining)} / ${compact(budget.total)}.${pace ? ` ${pace.title}: ${pace.detail}` : ''} Gợi ý kích cầu cho khách tăng trưởng tốt chưa nhận quỹ và các hạng mục còn dư:`,
      kpis: [{ label: 'Đã tiêu', value: compact(budget.spent) }, { label: 'Đang giữ chỗ', value: compact(budget.committed) }, { label: 'Khả dụng', value: compact(remaining), tone: 'teal' }],
      items, chips: ['Khách nào sắp vượt hạn mức công nợ?', 'Dự báo doanh thu 3 tháng'],
      note: 'Mức đề xuất ≈ 3% doanh số năm của khách, tối đa 10% quỹ còn lại; hạng mục chọn theo nhóm khách (đại lý → biển hiệu / quà dealer, nhà thầu → hội thảo kỹ thuật, chủ đầu tư → mẫu thử).',
    };
  };

  const debt = (): AiMsg => {
    const list = customers.filter((c) => c.debt > 0).map((c) => ({ c, r: c.creditLimit ? c.debt / c.creditLimit : 1 })).sort((a, b) => b.r - a.r).slice(0, 6);
    return {
      id: id(), role: 'ai',
      text: list.length ? `Tổng công nợ ${compact(customers.reduce((a, c) => a + c.debt, 0))}. Các khách sát hoặc vượt hạn mức:` : 'Chưa có công nợ phát sinh.',
      items: list.map(({ c, r }) => ({ title: `${c.name}: ${compact(c.debt)} / hạn mức ${compact(c.creditLimit)}`, detail: `${Math.round(r * 100)}% hạn mức${r > 1 ? ', đã vượt: tạm dừng giao hàng mới hoặc yêu cầu thanh toán trước' : r > 0.9 ? ', sắp chạm hạn mức' : ''}.`, tone: r > 1 ? 'red' : r > 0.9 ? 'orange' : 'blue', action: { label: 'Hồ sơ', run: () => { go('customers'); openCustomer(c.id); } } })),
      chips: ['Dự báo dòng tiền 3 tháng tới'],
    };
  };

  const brief = (): AiMsg => ({
    id: id(), role: 'ai',
    text: `Hôm nay có ${todo.length} yêu cầu chờ bạn duyệt và ${alerts.length} cảnh báo cần chú ý.`,
    kpis: [{ label: 'Chờ duyệt', value: String(todo.length), tone: todo.length ? 'red' : 'teal' }, { label: 'Cảnh báo', value: String(alerts.length) }, { label: 'Dự báo 3 tháng', value: compact(forecast.next3) }],
    items: [
      ...(todo.length ? [{ title: `${todo.length} yêu cầu chờ duyệt`, detail: todo.slice(0, 3).map((x) => x.title).join(' · '), tone: 'orange' as const, action: { label: 'Mở Công việc', run: () => go('tasks') } }] : []),
      ...alerts.slice(0, 5).map((a) => ({ title: a.title, detail: a.detail, tone: toneOf(a.tone), action: a.go ? { label: a.goLabel ?? 'Xem', run: () => go(a.go!) } : undefined })),
    ],
    chips: ['Dự án nào có rủi ro trễ SLA?', 'Gợi ý chương trình kích cầu quỹ MDF'],
  });

  return (raw: string): AiMsg => {
    const q = fold(raw);
    // Lệnh thao tác: "tạo PO mới", "đi tới thu chi"...
    const cmd = cmds.map((i) => [i, nlScore(raw, i)] as const).filter(([, sc]) => sc > 0).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (cmd && /^(tao|them|lap|nhap|di|chuyen|mo|vao)\b/.test(q)) { setTimeout(cmd.run, 0); return { id: id(), role: 'ai', text: `Đã thực hiện: ${cmd.label}.`, chips: ['Tóm tắt việc cần làm hôm nay'] }; }
    if (has(q, 'sla', 'tre han', 'tre ', 'qua han', 'qua tai', 'rui ro')) return sla();
    if (has(q, 'dong tien', 'cash', 'thanh khoan', 'so du', 'quy tien')) return cash();
    if (has(q, 'mdf', 'kich cau', 'chuong trinh', 'quy 3m', 'tai tro')) return mdf();
    if (has(q, 'cong no', 'phai thu', 'han muc', 'no xau')) return debt();
    if (has(q, 'du bao', 'doanh thu', 'doanh so', 'forecast')) return fc();
    if (has(q, 'tom tat', 'hom nay', 'tong quan', 'can lam', 'viec')) return brief();
    const c = customers.find((x) => q.includes(fold(x.code)) || (fold(x.name).length > 4 && (q.includes(fold(x.name)) || fold(x.name).includes(q))));
    if (c) {
      const ls = leads.filter((l) => l.customerId === c.id || (!!l.taxCode && l.taxCode === c.taxCode));
      return { id: id(), role: 'ai', text: `${c.name} (${c.code}): doanh số năm nay ${compact(c.ytdRevenue)}, công nợ ${compact(c.debt)} / ${compact(c.creditLimit)}.`, kpis: [{ label: 'Doanh số YTD', value: compact(c.ytdRevenue) }, { label: 'Công nợ', value: compact(c.debt), tone: c.creditLimit && c.debt > c.creditLimit * 0.9 ? 'red' : undefined }, { label: 'Dự án', value: String(ls.length) }], items: ls.slice(0, 4).map((l) => ({ title: `${l.code} · ${LEAD_STATUS[l.status].label}`, detail: `${l.boqNote || l.company} · ${compact(boqTotal(l))}`, tone: 'blue' as const, action: { label: 'Mở', run: openLead(l) } })), chips: ['Gợi ý chương trình kích cầu quỹ MDF'] };
    }
    if (cmd) { setTimeout(cmd.run, 0); return { id: id(), role: 'ai', text: `Đã thực hiện: ${cmd.label}.` }; }
    return { id: id(), role: 'ai', text: 'Mình chưa hiểu câu hỏi. Mình có thể phân tích rủi ro trễ SLA, dự báo doanh thu và dòng tiền, gợi ý chương trình quỹ MDF, công nợ, tóm tắt việc hôm nay, tra cứu khách hàng hoặc thực hiện lệnh (vd. “tạo PO mới”).', chips: AI_STARTERS };
  };
}

export function AiBubble({ m, onChip }: { m: AiMsg; onChip: (q: string) => void }) {
  const tone = { red: 'border-[rgb(var(--danger))]', orange: 'border-[rgb(var(--accent))]', blue: 'border-[rgb(var(--secondary))]', teal: 'border-[rgb(var(--success))]' };
  if (m.role === 'user') return <div className="flex justify-end"><p className="max-w-[85%] rounded-md rounded-tr-none bg-[rgb(var(--secondary))] px-3 py-2 text-sm text-white">{m.text}</p></div>;
  return (
    <div className="flex gap-2.5">
      <span className="g-brand mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded text-[rgb(var(--on-accent))]"><Sparkles className="h-4 w-4" aria-hidden /></span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm leading-relaxed text-[rgb(var(--fg2))]">{m.text}</p>
        {m.kpis && <div className="grid grid-cols-3 gap-2">{m.kpis.map((k) => <div key={k.label} className="rounded border border-[rgb(var(--ink)/0.06)] bg-[rgb(var(--ink)/0.03)] px-2 py-1.5"><p className="truncate text-[10px] uppercase tracking-wide text-[rgb(var(--muted))]">{k.label}</p><p className={cn('font-num truncate text-sm font-semibold', k.tone === 'red' ? 'text-[rgb(var(--danger-fg))]' : k.tone === 'teal' ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--fg))]')}>{k.value}</p></div>)}</div>}
        {m.items && m.items.length > 0 && (
          <ul className="space-y-1.5">
            {m.items.map((it, i) => (
              <li key={i} className={cn('flex items-start gap-2 rounded border-l-2 bg-[rgb(var(--ink)/0.03)] px-2.5 py-2', tone[it.tone ?? 'blue'])}>
                <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold text-[rgb(var(--fg))]">{it.title}</p>{it.detail && <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">{it.detail}</p>}</div>
                {it.action && <button className={cn(btnGhost, 'shrink-0 px-2 py-1 text-xs')} onClick={it.action.run}>{it.action.label}</button>}
              </li>
            ))}
          </ul>
        )}
        {m.note && <p className="text-[11px] italic text-[rgb(var(--faint))]">{m.note}</p>}
        {m.chips && <div className="flex flex-wrap gap-1.5">{m.chips.map((c) => <button key={c} className="rounded-full border border-[rgb(var(--ink)/0.1)] px-2.5 py-1 text-[11px] text-[rgb(var(--muted))] hover:border-[rgb(var(--secondary))] hover:text-[rgb(var(--fg))]" onClick={() => onChip(c)}>{c}</button>)}</div>}
      </div>
    </div>
  );
}

export function AiCopilotTab({ ask, onAsked }: { ask: string | null; onAsked: () => void }) {
  const app = useApp();
  const answer = useCopilot();
  const extra = useCopilotExtra();
  const ai = useAi('copilot');
  const [msgs, setMsgs] = useState<AiMsg[]>([]);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  /** Số liệu tính tất định trong app trước; có AI thì AI diễn giải và đề xuất trên chính số liệu đó */
  const send = (q: string) => {
    const v = q.trim();
    if (!v) return;
    const local = extra(v) ?? answer(v);
    const hist = msgs.slice(-6).map((m) => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.role === 'user' ? m.text : aiMsgText(m) }));
    while (hist.length && hist[0].role !== 'user') hist.shift();
    setMsgs((p) => [...p, { id: uid('u'), role: 'user', text: v }, ai.available ? { ...local, note: `${ai.label} đang phân tích…` } : local]);
    setText('');
    if (!ai.available) return;
    void ai.ask({ system: 'Bạn là AI Copilot điều hành: trả lời tối đa 10 dòng, dùng gạch đầu dòng, nêu rủi ro và đề xuất hành động cụ thể, chỉ dùng số liệu được cung cấp.', history: hist, maxTokens: 900,
      prompt: `Câu hỏi: ${v}\n\nKết quả phân tích tính sẵn từ CRM:\n${aiMsgText(local)}\n\nTổng quan dữ liệu:\n${buildAiContext(app, app.now ?? Date.now())}` })
      .then((r) => setMsgs((p) => p.map((m) => (m.id !== local.id ? m : r.ok ? { ...local, text: r.text, note: `${AI_NAME[r.provider]} · ${r.model} · trên số liệu CRM` } : { ...local, note: `AI chưa trả lời được (${r.error}), hiển thị phân tích cục bộ` }))));
  };
  useEffect(() => { if (ask) { send(ask); onAsked(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ask]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [msgs.length]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {!msgs.length && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center opacity-50">
            <Sparkles className="h-6 w-6 text-[rgb(var(--faint))]" aria-hidden />
            <p className="max-w-[240px] text-[13px] text-[rgb(var(--faint))]">Hỏi AI về rủi ro SLA, dòng tiền quỹ MDF, thưởng đại lý, công nợ… Gõ @AI trong chat nhóm để hỏi nhanh.</p>
            <p className="text-[11px] text-[rgb(var(--faint))]">{ai.available ? `Đã kết nối ${ai.label}` : 'Phân tích cục bộ (chưa kết nối AI)'}</p>
          </div>
        )}
        {msgs.map((m) => <AiBubble key={m.id} m={m} onChip={send} />)}
        <div ref={endRef} />
      </div>
      <form className="border-t border-[rgb(var(--ink)/0.06)] p-3" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <div className="flex items-center gap-2 rounded-md border border-[rgb(var(--ink)/0.1)] bg-[rgb(var(--sunken))] px-2 focus-within:border-[rgb(var(--secondary))]">
          <Sparkles className="h-4 w-4 shrink-0 text-[rgb(var(--faint))]" aria-hidden />
          <input className="h-11 flex-1 bg-transparent text-sm text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted)/0.7)] focus:outline-none" value={text} onChange={(e) => setText(e.target.value)} placeholder="Hỏi về SLA, dòng tiền, quỹ MDF…" aria-label="Câu hỏi cho AI Copilot" />
          <button className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all', text.trim() ? 'g-brand text-[rgb(var(--on-accent))]' : 'text-[rgb(var(--faint))]')} disabled={!text.trim()} aria-label="Gửi câu hỏi"><Send className="h-4 w-4" aria-hidden /></button>
        </div>
      </form>
    </div>
  );
}

export function ChatTab({ seen, markSeen }: { seen: Record<string, number>; markSeen: (k: string) => void }) {
  const { comments, addComment, userName, me, leads, customers, jobs, pos, channels, users, go } = useApp();
  const links = useDeepLinks();
  const [cur, setCur] = useSticky<Thread | null>('ChatTab.cur', null);
  const [q, setQ] = useSticky('ChatTab.q', '');
  const general: Thread = { entity: 'channel', entityId: 'general', title: 'Kênh chung', sub: 'Toàn doanh nghiệp', module: 'overview' };
  const resolve = (entity: CommentEntity, entityId: string): Thread | null => {
    if (entity === 'channel') {
      if (entityId === 'general') return general;
      if (entityId.startsWith('dm:')) { const o = users.find((u) => u.id !== me?.id && entityId.split(':').includes(u.id)); return o && me && entityId.split(':').includes(me.id) ? { entity, entityId, title: o.name, sub: 'Tin nhắn trực tiếp', module: 'messages' } : null; }
      const g = channels.find((x) => x.id === entityId && !!me && (x.members.includes(me.id) || x.createdBy === me.id));
      return g ? { entity, entityId, title: g.name, sub: `Nhóm · ${g.members.length} người`, module: 'messages' } : null;
    }
    if (entity === 'lead') { const l = leads.find((x) => x.id === entityId); return l ? { entity, entityId, title: l.company, sub: `${l.code} · ${LEAD_STATUS[l.status].label}`, module: 'projects', token: l.code } : null; }
    if (entity === 'customer') { const c = customers.find((x) => x.id === entityId); return c ? { entity, entityId, title: c.name, sub: `${c.code} · Khách hàng`, module: 'customers', token: c.code } : null; }
    if (entity === 'job') { const j = jobs.find((x) => x.id === entityId); return j ? { entity, entityId, title: jobCustName(j, customers), sub: `${j.code} · Đơn hàng`, module: 'jobs', token: j.code } : null; }
    const p = pos.find((x) => x.id === entityId); return p ? { entity, entityId, title: p.vendor, sub: `${p.code} · PO`, module: 'supply', token: p.code } : null;
  };
  const groups = new Map<string, RowComment[]>();
  comments.forEach((c) => { const k = threadKey(c); groups.set(k, [...(groups.get(k) ?? []), c]); });
  const threads = [...groups.entries()].filter(([k]) => k !== 'channel:general').map(([k, list]) => ({ k, last: list.reduce((a, b) => (a.at > b.at ? a : b)), list })).sort((a, b) => b.last.at - a.last.at);
  const unread = (k: string, list: RowComment[]) => list.filter((c) => c.authorId !== me?.id && c.at > (seen[k] ?? 0)).length;
  const t = fold(q.trim());
  const found: Thread[] = t ? [
    ...leads.filter((l) => fold(`${l.code} ${l.company}`).includes(t)).slice(0, 5).map((l) => resolve('lead', l.id)!),
    ...jobs.filter((j) => fold(`${j.code} ${j.title} ${jobCustName(j, customers)}`).includes(t)).slice(0, 5).map((j) => resolve('job', j.id)!),
    ...pos.filter((p) => fold(`${p.code} ${p.vendor}`).includes(t)).slice(0, 3).map((p) => resolve('po', p.id)!),
    ...customers.filter((c) => fold(`${c.code} ${c.name}`).includes(t)).slice(0, 3).map((c) => resolve('customer', c.id)!),
  ].filter(Boolean) : [];
  const open = (th: Thread) => { setCur(th); markSeen(threadKey(th)); };
  const list = cur ? comments.filter((c) => c.entity === cur.entity && c.entityId === cur.entityId).sort((a, b) => a.at - b.at) : [];
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); if (cur) markSeen(threadKey(cur)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [list.length, cur?.entityId]);
  if (cur) {
    const link = cur.token ? links.find((d) => d.token === cur.token) : undefined;
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-[rgb(var(--ink)/0.06)] px-3 py-2.5">
          <button className="rounded p-1 text-[rgb(var(--muted))] hover:bg-[rgb(var(--ink)/0.1)] hover:text-[rgb(var(--fg))]" onClick={() => setCur(null)} aria-label="Quay lại danh sách kênh"><ArrowLeft className="h-4 w-4" /></button>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[rgb(var(--ink)/0.06)] text-[rgb(var(--accent-fg))]">{cur.entity === 'channel' ? <Hash className="h-4 w-4" aria-hidden /> : <MessageSquare className="h-4 w-4" aria-hidden />}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{cur.title}</p><p className="truncate text-[11px] text-[rgb(var(--muted))]">{cur.sub}</p></div>
          {link && <button className={cn(btnGhost, 'px-2 py-1 text-xs')} onClick={link.open} title="Mở đúng bản ghi"><ExternalLink className="h-3.5 w-3.5" aria-hidden />Mở</button>}
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {!list.length && <EmptyState text={<>Bắt đầu trao đổi</>} hint={<>Gõ @ để gắn thẻ đồng nghiệp, # để chèn liên kết tới dự án, đơn hàng hoặc báo cáo.</>} art="inbox" compact />}
          {list.map((c) => (
            <div key={c.id} className={cn('flex gap-2.5', c.authorId === me?.id && 'flex-row-reverse')}>
              <Avatar name={userName(c.authorId)} size={26} />
              <div className={cn('min-w-0 max-w-[85%]', c.authorId === me?.id && 'text-right')}>
                <p className="text-[11px] text-[rgb(var(--faint))]"><b className="text-[rgb(var(--fg2))]">{c.authorId === me?.id ? 'Bạn' : userName(c.authorId)}</b> · {new Date(c.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</p>
                {c.text && <p className={cn('mt-0.5 inline-block whitespace-pre-wrap break-words rounded-md px-3 py-2 text-left text-sm leading-relaxed', c.authorId === me?.id ? 'rounded-tr-none bg-[rgb(var(--secondary)/0.3)] text-[rgb(var(--fg2))]' : 'rounded-tl-none bg-[rgb(var(--ink)/0.05)] text-[rgb(var(--fg2))]')}><MentionText text={c.text} /></p>}
                {c.files?.length ? <ChatFiles files={c.files} /> : null}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="border-t border-[rgb(var(--ink)/0.06)] p-3"><MentionComposer onSend={(text, mentions) => addComment({ entity: cur.entity, entityId: cur.entityId, text, mentions, module: cur.module }, cur.title)} /></div>
      </div>
    );
  }
  const gList = groups.get('channel:general') ?? [];
  const row = (th: Thread, last?: RowComment, n = 0) => (
    <button key={threadKey(th)} className="flex w-full items-center gap-3 rounded px-2.5 py-2 text-left hover:bg-[rgb(var(--ink)/0.04)]" onClick={() => open(th)}>
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded', th.entity === 'channel' ? 'g-brand text-[rgb(var(--on-accent))]' : 'bg-[rgb(var(--ink)/0.06)] text-[rgb(var(--muted))]')}>{th.entity === 'channel' ? <Hash className="h-4 w-4" aria-hidden /> : <MessageSquare className="h-4 w-4" aria-hidden />}</span>
      <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-medium">{th.title}</span>{th.token && <span className="shrink-0 font-mono text-[10px] text-[rgb(var(--faint))]">{th.token}</span>}</span><span className="block truncate text-xs text-[rgb(var(--muted))]">{last ? `${last.authorId === me?.id ? 'Bạn' : userName(last.authorId)}: ${last.text || (last.files?.length ? `[${last.files.length} file]` : '')}` : th.sub}</span></span>
      {n > 0 && <span className="g-brand flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-[rgb(var(--on-accent))]">{n}</span>}
    </button>
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[rgb(var(--ink)/0.06)] p-3">
        <div className="flex gap-2">
          <div className="relative flex-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--muted))]" aria-hidden /><input className={cn(inputCls, 'py-2 pl-8 text-sm')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mở kênh theo dự án, mã đơn, PO…" aria-label="Tìm kênh trao đổi" /></div>
          <button className={cn(btnGhost, 'shrink-0 px-2.5')} onClick={() => go('messages')} title="Mở Tin nhắn toàn màn hình: nhóm, tin nhắn trực tiếp, gửi file, tìm lịch sử" aria-label="Mở Tin nhắn toàn màn hình"><Maximize2 className="h-4 w-4" aria-hidden /></button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {t ? (
          <>{found.map((th) => row(th, groups.get(threadKey(th))?.slice(-1)[0], unread(threadKey(th), groups.get(threadKey(th)) ?? [])))}{!found.length && <p className="px-3 py-6 text-center text-xs text-[rgb(var(--muted))]">Không tìm thấy dự án / đơn khớp “{q}”.</p>}</>
        ) : (
          <>
            {row(general, gList.slice(-1)[0], unread('channel:general', gList))}
            <p className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--faint))]">Nhóm, tin nhắn & dự án</p>
            {threads.map(({ k, last, list: l2 }) => { const cut = k.indexOf(':'); const th = resolve(k.slice(0, cut) as CommentEntity, k.slice(cut + 1)); return th ? row(th, last, unread(k, l2)) : null; })}
            {!threads.length && <p className="px-3 py-4 text-xs text-[rgb(var(--muted))]">Chưa có trao đổi theo dự án. Tìm mã dự án / đơn ở ô phía trên để mở kênh, hoặc bấm biểu tượng bình luận trên dòng bảng.</p>}
          </>
        )}
      </div>
    </div>
  );
}

/** Cột phải: Chat nội bộ + AI Copilot. Màn rộng (≥1280px) neo cố định, đẩy nội dung sang trái; màn hẹp trượt phủ */
export function CommHub({ tab, onTab, onClose, ask, onAsked, seen, markSeen }: { tab: 'chat' | 'ai'; onTab: (t: 'chat' | 'ai') => void; onClose: () => void; ask: string | null; onAsked: () => void; seen: Record<string, number>; markSeen: (k: string) => void }) {
  return (
    <div className="glass flex h-full flex-col border-l border-[rgb(var(--ink)/0.08)]">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-[rgb(var(--ink)/0.06)] px-3">
        <div className="flex flex-1 rounded-md border border-[rgb(var(--ink)/0.1)] bg-[rgb(var(--sunken))] p-1" role="tablist" aria-label="Trung tâm trao đổi">
          {([['chat', 'Chat nội bộ', MessageSquare], ['ai', 'AI Copilot', Sparkles]] as const).map(([v, l, I]) => (
            <button key={v} role="tab" aria-selected={tab === v} onClick={() => onTab(v)} className={cn('flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold', tab === v ? 'g-brand text-[rgb(var(--on-accent))]' : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')}><I className="h-3.5 w-3.5" aria-hidden />{l}</button>
          ))}
        </div>
        <button className={cn(btnGhost, 'p-1.5')} onClick={onClose} aria-label="Đóng trung tâm trao đổi"><X className="h-4 w-4" /></button>
      </div>
      {tab === 'chat' ? <ChatTab seen={seen} markSeen={markSeen} /> : <AiCopilotTab ask={ask} onAsked={onAsked} />}
    </div>
  );
}

