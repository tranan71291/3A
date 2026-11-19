'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Field, SideSheet } from '../../components/ui';
import { AI_NAME, aiMsgText, bizMode, boqTotal, btnAccent, btnGhost, btnPrimary, compact, fmtN, fold, givenName, inputCls, MDF_REIMBURSE_LAG_DAYS, plainMd, uid, useApp, WRITER, WRITER_TONES } from '../../lib/core';
import type { AiMsg, Brief, CompanyInfo, JobStage, WriterPreset } from '../../lib/types';
import { cn } from '../../lib/utils';
import { jobStageOf } from '../../lib/workshop';
import { buildAiContext, dealerBonus, kbFor, mdfForecast, parseMoneyVi, slaRisks, useAi } from './ai-core';
import { isSmallTalk, useCopilot } from '../messages/comm-hub';
import { useApprovalQueue } from '../tasks/tasks';

/** Bổ sung cho Copilot cục bộ: dự báo quỹ MDF, thưởng đại lý, bản tin điều hành, tra cứu chính sách */
export function useCopilotExtra(): (q: string) => AiMsg | null {
  const app = useApp();
  const { budget, programs, claims, kb, myCustomers: customers, go, now, company } = app;
  const t = now ?? Date.now();
  const brief = useBriefData();
  return (q0: string) => {
    const q = fold(q0);
    const id = uid('ai');
    if (/(quy|mdf)/.test(q) && /(du bao|dong tien|hoan|con lai|thang toi)/.test(q) && bizMode(company) !== 'MFG') {
      const f = mdfForecast(budget, programs, claims, t);
      return {
        id, role: 'ai', text: `Dự báo dòng tiền quỹ ${budget.vendor} 6 tháng tới (giả định Hãng hoàn tiền sau ${MDF_REIMBURSE_LAG_DAYS} ngày kể từ khi nộp claim):`,
        kpis: [{ label: 'Quỹ còn khả dụng', value: compact(f.remaining) }, { label: 'Đang chờ Hãng hoàn', value: compact(f.pendingNow), tone: f.pendingNow > f.remaining ? 'red' : undefined }, { label: 'Đã dùng / cam kết', value: `${Math.round(f.usedPct)}%` }],
        items: [
          ...f.rows.map((r) => ({ title: `${r.label}: chi ${compact(r.out)} · hoàn về ${compact(r.inflow)}`, detail: `Cuối tháng còn chờ hoàn ${compact(r.pendingEnd)}, quỹ khả dụng ${compact(r.balanceEnd)}`, tone: r.balanceEnd < 0 ? 'red' as const : r.inflow > 0 ? 'teal' as const : 'blue' as const })),
          ...f.late.map((c) => ({ title: `Claim ${c.code} còn ${c.daysLeft} ngày hạn nộp`, detail: `${c.programTitle} · ${compact(c.claimed)}`, tone: 'orange' as const, action: { label: 'Mở claim', run: () => app.openClaim(c.id) } })),
          ...(f.daysToEnd != null && f.daysToEnd < 90 && f.remaining > 0 ? [{ title: `Còn ${f.daysToEnd} ngày đến hết kỳ quỹ, chưa dùng ${compact(f.remaining)}`, detail: 'Cân nhắc lập thêm chương trình để không mất quỹ', tone: 'orange' as const, action: { label: 'Lập chương trình', run: () => app.openProgramForm() } }] : []),
        ],
        chips: ['Claim nào sắp hết hạn?', 'Bản tin điều hành hôm nay'],
        note: 'Tính từ claim chưa hoàn, chương trình đã duyệt chưa claim và ngân sách năm',
      };
    }
    const rule = kb.find((k) => k.rule?.kind === 'DEALER_GROWTH_BONUS')?.rule;
    if (/(thuong|bonus)/.test(q) && /(dai ly|dealer|tang truong|doanh thu)/.test(q)) {
      if (!rule) return { id, role: 'ai', text: 'Chưa có chính sách thưởng tăng trưởng đại lý trong Kiến thức AI. Khai báo ở Cài đặt > AI & Zalo > Kiến thức cho AI (mức tăng trưởng tối thiểu, bậc doanh thu, tiền thưởng mỗi bậc).' };
      const nums = parseMoneyVi(q0);
      const head = `Chính sách: tăng trưởng từ ${rule.minGrowthPct}% được thưởng ${compact(rule.bonusPerStep)} cho mỗi ${compact(rule.stepRevenue)} doanh thu tăng thêm${rule.base === 'ABOVE_THRESHOLD' ? ' (tính trên phần vượt ngưỡng)' : ''}.`;
      if (nums.length >= 2) {
        const [last, cur] = nums;
        const b = dealerBonus(rule, last, cur);
        return { id, role: 'ai', text: `${head}\nDoanh thu năm trước ${compact(last)}, năm nay ${compact(cur)}: tăng ${compact(b.inc)} (${b.growth.toFixed(1)}%).`, kpis: [{ label: 'Tăng trưởng', value: `${b.growth.toFixed(1)}%`, tone: b.ok ? 'teal' : 'red' }, { label: 'Tiền thưởng', value: b.ok ? fmtN(b.bonus) + 'đ' : '0đ', tone: b.ok ? 'teal' : undefined }],
          items: [b.ok ? { title: `Đạt ${b.steps} bậc thưởng`, detail: `Thêm ${compact(b.toNext)} doanh thu để lên bậc tiếp theo`, tone: 'teal' } : { title: `Chưa đạt ngưỡng ${rule.minGrowthPct}%`, detail: `Cần thêm ${compact(b.needFor7)} doanh thu`, tone: 'orange' }] };
      }
      const named = customers.filter((c) => q.includes(fold(c.name)) || q.includes(fold(c.code)) || (givenName(c.name).length > 3 && q.includes(fold(c.name).split(' ').slice(-2).join(' '))));
      const pool = (named.length ? named : customers.filter((c) => /dealer|dai ly|npp|phan phoi/.test(fold(`${c.segment} ${c.tier} ${c.name}`)) || c.lastYearRevenue > 0)).filter((c) => c.lastYearRevenue > 0 || c.ytdRevenue > 0);
      const rows = pool.map((c) => ({ c, b: dealerBonus(rule, c.lastYearRevenue, c.ytdRevenue) })).sort((a, b) => b.b.bonus - a.b.bonus || b.b.growth - a.b.growth).slice(0, 8);
      return {
        id, role: 'ai', text: `${head}\nTạm tính theo doanh số năm nay so với năm trước của ${named.length ? 'khách được nhắc' : 'đại lý'}:`,
        kpis: [{ label: 'Đại lý đạt thưởng', value: `${rows.filter((r) => r.b.ok).length}/${rows.length}` }, { label: 'Tổng thưởng tạm tính', value: compact(rows.reduce((s, r) => s + r.b.bonus, 0)) }],
        items: rows.map(({ c, b }) => ({ title: `${c.name}: ${b.growth.toFixed(1)}% · thưởng ${compact(b.bonus)}`, detail: b.ok ? `Tăng ${compact(b.inc)}, thêm ${compact(b.toNext)} để lên bậc tiếp` : `Cần thêm ${compact(b.needFor7)} để đạt ${rule.minGrowthPct}%`, tone: b.ok ? 'teal' as const : 'orange' as const, action: { label: 'Mở khách hàng', run: () => { go('customers'); app.openCustomer(c.id); } } })),
        note: 'Tạm tính trên doanh số YTD trong CRM; số quyết toán theo chính sách đầy đủ',
      };
    }
    if (/(ban tin|tom tat dieu hanh|executive|bao cao sang)/.test(q)) {
      return { id, role: 'ai', text: `Bản tin điều hành ${new Date(t).toLocaleDateString('vi-VN')}:`, kpis: brief.kpis, items: brief.sections.flatMap((s) => s.items.slice(0, 3).map((x) => ({ title: `${s.title}: ${x}` }))) };
    }
    if (/(quy dinh|chinh sach|quy che)/.test(q)) {
      const hits = kbFor(kb, q0);
      if (hits.length) return { id, role: 'ai', text: 'Theo kiến thức nội bộ đã khai báo:', items: hits.map((k) => ({ title: k.title, detail: k.body })) };
    }
    return null;
  };
}

export function useBriefData(): Omit<Brief, 'id' | 'date' | 'at'> {
  const app = useApp();
  const { company, myLeads: leads, myCustomers: customers, budget, programs, claims, jobs, receipts, workOrders, installJobs, now } = app;
  const { todo } = useApprovalQueue();
  const t = now ?? Date.now();
  const mode = bizMode(company);
  const sections: Brief['sections'] = [];
  const kpis: Brief['kpis'] = [];
  const day = 864e5;
  if (mode !== 'MFG') {
    const fresh = leads.filter((l) => l.receivedDaysAgo <= 1);
    const won7 = leads.filter((l) => l.status === 'WON' && l.wonAt && t - new Date(l.wonAt).getTime() < 7 * day);
    const open = leads.filter((l) => !['WON', 'LOST'].includes(l.status));
    kpis.push({ label: 'Lead mới 24h', value: String(fresh.length) }, { label: 'Chốt 7 ngày', value: compact(won7.reduce((s, l) => s + (l.wonAmount ?? boqTotal(l)), 0)), tone: 'teal' }, { label: 'Pipeline mở', value: compact(open.reduce((s, l) => s + boqTotal(l), 0)) });
    sections.push({ title: 'Kinh doanh', items: [`${fresh.length} lead mới trong 24 giờ, ${open.length} lead / dự án đang mở`, ...won7.slice(0, 3).map((l) => `Chốt ${l.company}: ${compact(l.wonAmount ?? boqTotal(l))}`)] });
    const risks = slaRisks(leads, t);
    if (risks.length) { kpis.push({ label: 'Rủi ro SLA', value: String(risks.length), tone: 'red' }); sections.push({ title: 'Rủi ro trễ SLA', items: risks.slice(0, 5).map((r) => `${r.lead.code} ${r.lead.company}: ${r.reasons.join(', ')}`) }); }
    const f = mdfForecast(budget, programs, claims, t);
    sections.push({ title: `Quỹ ${budget.vendor}`, items: [`Còn khả dụng ${compact(f.remaining)} (đã dùng ${Math.round(f.usedPct)}%), chờ Hãng hoàn ${compact(f.pendingNow)}`, ...(f.rows[0].inflow ? [`Dự kiến hoàn về tháng này ${compact(f.rows[0].inflow)}`] : []), ...f.late.map((c) => `Claim ${c.code} còn ${c.daysLeft} ngày hạn nộp`)] });
  }
  if (mode !== 'TRADING') {
    const live = jobs.filter((j) => !j.lostAt);
    const st = (s: JobStage) => live.filter((j) => jobStageOf(j, workOrders, installJobs, receipts) === s).length;
    const conf = receipts.filter((r) => r.status === 'CONFIRMED' && r.confirmedAt && t - r.confirmedAt < 7 * day).reduce((s, r) => s + r.amount, 0);
    kpis.push({ label: 'Thu 7 ngày', value: compact(conf), tone: 'teal' }, { label: 'Đang sản xuất', value: String(st('PRODUCTION')) });
    sections.push({ title: 'Xưởng & đơn hàng', items: [`Chờ khảo sát ${st('SURVEY')}, đã báo giá ${st('QUOTED')}, đang sản xuất ${st('PRODUCTION')}, chờ lắp ${st('INSTALL')}, chờ thu tiền ${st('WAIT_PAYMENT')}`, `Tiền đã xác nhận 7 ngày: ${compact(conf)}`] });
  }
  const over = customers.filter((c) => c.creditLimit > 0 && c.debt > c.creditLimit);
  if (over.length) sections.push({ title: 'Công nợ', items: over.slice(0, 4).map((c) => `${c.name} nợ ${compact(c.debt)} / hạn mức ${compact(c.creditLimit)}`) });
  if (todo.length) { kpis.push({ label: 'Chờ bạn duyệt', value: String(todo.length), tone: 'red' }); sections.push({ title: 'Việc chờ duyệt', items: [`${todo.length} việc đang chờ bạn quyết định ở phân hệ Công việc`] }); }
  return { kpis, sections };
}

/** Bản soạn theo mẫu khi chưa kết nối AI */
export function localWrite(p: WriterPreset, ctx: string, points: string, company: CompanyInfo, staff: string): string {
  const brand = company.shortName || company.appName;
  const pts = points.split(/\n|;/).map((x) => x.trim()).filter(Boolean);
  const name = ctx.match(/Khách[^:]*:\s*([^,\n]+)/)?.[1]?.trim() ?? 'Quý khách';
  const bullet = pts.length ? pts.map((x) => `• ${x}`).join('\n') : '• Sản phẩm chính hãng, bảo hành đầy đủ\n• Tư vấn kỹ thuật miễn phí\n• Giao hàng đúng hẹn';
  switch (p) {
    case 'QUOTE_EMAIL': return `Tiêu đề: ${brand} gửi báo giá${pts[0] ? ` ${pts[0]}` : ''}\n\nKính gửi ${name},\n\n${brand} trân trọng cảm ơn Quý khách đã quan tâm. Chúng tôi xin gửi kèm báo giá chi tiết theo yêu cầu với các điểm chính:\n${bullet}\n\nBáo giá có hiệu lực 15 ngày. Nếu cần điều chỉnh số lượng hoặc tiến độ giao hàng, Quý khách vui lòng phản hồi email này hoặc liên hệ trực tiếp với tôi.\n\nTrân trọng,\n${staff}\n${company.legalName}\n${company.phone}`;
    case 'CARE_MSG': return `Dạ em chào ${name}, em là ${staff} bên ${brand}. ${pts[0] ? `${pts[0]}. ` : 'Em hỏi thăm sản phẩm bên em có đang dùng tốt không ạ? '}Nếu cần hỗ trợ gì ${name} cứ nhắn em nhé, em luôn sẵn sàng ạ.`;
    case 'ZALO_OA': return `${pts[0] ?? `${brand} – Ưu đãi tháng này`}\n\n${pts.slice(1).join('. ') || `Chương trình dành riêng cho khách hàng quan tâm ${brand}: tư vấn miễn phí, ưu đãi giá tốt, số lượng có hạn.`}\n\nNút: Nhận tư vấn ngay`;
    case 'AD_POST': return `🔥 ${pts[0] ?? `${brand} – giải pháp chuẩn chất lượng cho công trình của bạn`}\n\n${bullet}\n\n👉 Inbox ngay hoặc gọi ${company.phone} để nhận báo giá trong 30 phút.\n\n#${brand.replace(/\s+/g, '')} #giaiphapcongtrinh #uudai`;
    case 'PRESS': return `${(pts[0] ?? `${brand} công bố chương trình mới`).toUpperCase()}\n\n${new Date().toLocaleDateString('vi-VN')} – ${company.legalName} ${pts[1] ? pts[1].toLowerCase() : 'chính thức triển khai chương trình nhằm mang đến cho khách hàng giải pháp chất lượng, minh bạch về giá.'}\n\n${bullet}\n\n“Chúng tôi cam kết đồng hành cùng khách hàng và đối tác”, đại diện ${brand} cho biết.\n\nThông tin liên hệ: ${company.legalName}, ${company.address}, ĐT ${company.phone}, ${company.email}.`;
    case 'ZNS': return `${brand}: ${pts[0] ?? 'Cam on Quy khach da tin tuong. Moi thac mac vui long lien he'} ${company.phone}`.slice(0, 300);
  }
}

export function useWriter() {
  const { company, me } = useApp();
  const ai = useAi('writer');
  const write = async (p: WriterPreset, tone: string, points: string, ctx: string): Promise<{ text: string; by: string; error?: string }> => {
    if (ai.available) {
      const r = await ai.ask({ system: `Bạn là chuyên viên nội dung marketing & chăm sóc khách hàng của ${company.legalName || company.appName}. ${WRITER[p].brief} Giọng văn: ${tone}. Chỉ trả về nội dung hoàn chỉnh, không giải thích.`, prompt: `Ý chính:\n${points || '(tự đề xuất)'}\n\nNgữ cảnh:\n${ctx || '(không có)'}\n\nNgười soạn: ${me?.name}. Thông tin công ty: ${company.legalName}, ${company.phone}, ${company.website ?? ''}.`, maxTokens: 1200 });
      if (r.ok) return { text: WRITER[p].max ? r.text.slice(0, WRITER[p].max) : r.text, by: `${AI_NAME[r.provider]} · ${r.model}` };
      return { text: localWrite(p, ctx, points, company, me?.name ?? ''), by: 'Mẫu soạn sẵn', error: r.error };
    }
    return { text: localWrite(p, ctx, points, company, me?.name ?? ''), by: 'Mẫu soạn sẵn (chưa kết nối AI)' };
  };
  return { write, ai };
}

export function AiWriterSheet({ preset, context = '', onUse, onClose }: { preset: WriterPreset; context?: string; onUse?: (text: string) => void; onClose: () => void }) {
  const { notify } = useApp();
  const { write, ai } = useWriter();
  const [p, setP] = useState<WriterPreset>(preset);
  const [tone, setTone] = useState(WRITER_TONES[0]);
  const [points, setPoints] = useState('');
  const [ctx, setCtx] = useState(context);
  const [out, setOut] = useState('');
  const [by, setBy] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async () => { setBusy(true); const r = await write(p, tone, points, ctx); setOut(r.text); setBy(r.by); setBusy(false); if (r.error) notify(`AI lỗi (${r.error}), dùng mẫu soạn sẵn`, 'orange'); };
  return (
    <SideSheet title="Soạn nội dung" sub={ai.available ? `AI: ${ai.label}` : 'Chưa kết nối AI: soạn theo mẫu, có thể sửa tay'} onClose={onClose} width="sm:w-[560px]"
      footer={<><button className={btnGhost} onClick={() => { void navigator.clipboard?.writeText(out); notify('Đã sao chép', 'teal'); }} disabled={!out}>Sao chép</button>{onUse && <button className={btnPrimary} disabled={!out} onClick={() => { onUse(out); onClose(); }}>Dùng nội dung này</button>}</>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Loại nội dung"><select className={inputCls} value={p} onChange={(e) => setP(e.target.value as WriterPreset)}>{(Object.keys(WRITER) as WriterPreset[]).map((k) => <option key={k} value={k}>{WRITER[k].label}</option>)}</select></Field>
          <Field label="Giọng văn"><select className={inputCls} value={tone} onChange={(e) => setTone(e.target.value)}>{WRITER_TONES.map((x) => <option key={x}>{x}</option>)}</select></Field>
        </div>
        <Field label="Ý chính muốn nói" hint="Mỗi ý một dòng: sản phẩm, ưu đãi, thời hạn…"><textarea className={cn(inputCls, 'min-h-[84px]')} value={points} onChange={(e) => setPoints(e.target.value)} /></Field>
        <Field label="Ngữ cảnh (tự lấy từ hồ sơ, có thể sửa)"><textarea className={cn(inputCls, 'min-h-[72px] text-xs')} value={ctx} onChange={(e) => setCtx(e.target.value)} /></Field>
        <button className={cn(btnAccent, 'w-full')} onClick={() => void run()} disabled={busy}><Sparkles className="h-4 w-4" aria-hidden />{busy ? 'Đang soạn…' : out ? 'Soạn lại' : ai.available ? 'Viết bằng AI' : 'Tạo bản soạn theo mẫu'}</button>
        {out && (
          <Field label={`Nội dung${by ? ` · ${by}` : ''}${WRITER[p].max ? ` · ${out.length}/${WRITER[p].max} ký tự` : ''}`}>
            <textarea className={cn(inputCls, 'min-h-[220px]')} value={out} onChange={(e) => setOut(e.target.value)} />
          </Field>
        )}
      </div>
    </SideSheet>
  );
}

// ---------------------------------------------------------------------
//  @AI trong chat nhóm: gõ "@AI câu hỏi" ở bất kỳ kênh / tin nhắn / bình luận nào
// ---------------------------------------------------------------------
export function AiChatBot() {
  const app = useApp();
  const { comments, me, addBotComment, kb, now, hubCfg } = app;
  const local = useCopilot();
  const extra = useCopilotExtra();
  const ai = useAi('chat');
  const since = useRef(Date.now());
  const done = useRef(new Set<string>());
  useEffect(() => {
    if (!me || !hubCfg.ai.enabled) return;
    const fresh = comments.filter((c) => c.authorId === me.id && c.at >= since.current && !done.current.has(c.id) && /(^|\s)@ai\b/i.test(c.text));
    fresh.forEach((c) => {
      done.current.add(c.id);
      const q = c.text.replace(/(^|\s)@ai\b/gi, ' ').trim();
      if (!q) return;
      void (async () => {
        const small = isSmallTalk(q);
        const m = small ? null : extra(q) ?? local(q);
        let text = m ? aiMsgText({ ...m, note: undefined }) : 'Chào anh/chị! Cần mình xem số liệu gì cứ gõ @AI kèm câu hỏi nhé.';
        if (ai.available) {
          const facts = small ? '' : kbFor(kb, q).map((k) => `Chính sách "${k.title}": ${k.body}`).join('\n');
          const ctx = small ? '' : `\n\nKiến thức nội bộ:\n${facts || '(không có mục phù hợp)'}\n\nDữ liệu CRM:\n${buildAiContext(app, now ?? Date.now())}`;
          const r = await ai.ask({
            system: 'Bạn là trợ lý @AI trong nhóm chat nội bộ. Trả lời tự nhiên, thẳng vào câu hỏi, độ dài tương xứng (xã giao 1 câu, số liệu tối đa 6 dòng). Viết chữ thường, không dùng Markdown, không tự giới thiệu.' + ctx,
            prompt: m && !m.fallback ? `${q}\n\n[Kết quả tính sẵn]\n${text}` : q, maxTokens: small ? 200 : 600,
          });
          if (r.ok) text = plainMd(r.text.trim());
        }
        addBotComment({ entity: c.entity, entityId: c.entityId, text, mentions: [c.authorId], module: c.module, parentId: c.parentId });
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments.length]);
  return null;
}

