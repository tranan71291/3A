'use client';

import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { removeWithUndo } from '../../app/context';
import { CatalogTable } from '../../components/crud';
import { SetBlock, SideCard } from '../../components/ui';
import { btnGhost, btnSm, compact, pct, SOURCE_LABEL, uid, useApp } from '../../lib/core';
import type { CheckItem, Lead, MktItem, Opt, Source } from '../../lib/types';
import { cn } from '../../lib/utils';
import { parseAiJson, useAi } from '../ai/ai-core';
import { CheckList } from '../sales/quote';

// =====================================================================
//  CÀI ĐẶT: NGÂN SÁCH MARKETING NỘI BỘ (tách khỏi quỹ 3M)
// =====================================================================

export function MarketingBudgetSettings() {
  const { mktItems, setMktItems, canDo, notify, leads, company } = useApp();
  const canEdit = canDo('settings.edit') || canDo('lead.create');
  const planned = mktItems.reduce((s, i) => s + i.planned, 0);
  const spent = mktItems.reduce((s, i) => s + i.spent, 0);
  const sourceOpts: Opt[] = [{ value: '', label: 'Không gắn kênh lead' }, ...(Object.keys(SOURCE_LABEL) as Source[]).map((s) => ({ value: s, label: SOURCE_LABEL[s] }))];
  const srcSet = new Set(mktItems.map((i) => i.source).filter(Boolean));
  const mktLeads = leads.filter((l) => srcSet.has(l.source));
  const revenue = mktLeads.filter((l) => l.status === 'WON').reduce((s0, l) => s0 + (l.wonAmount ?? 0), 0);
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        <div className="kpi-strip grid grid-cols-2 lg:grid-cols-4">
          {([['Kế hoạch năm', compact(planned), ''], ['Đã chi', compact(spent), `${pct(spent, planned)} kế hoạch`], ['Chi phí mỗi lead', mktLeads.length ? compact(spent / mktLeads.length) : '—', `${mktLeads.length} lead từ các kênh`], ['ROI', spent && revenue ? `${(revenue / spent).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}×` : '—', revenue ? `doanh thu ${compact(revenue)}` : 'chưa có đơn chốt từ kênh']] as const).map(([l, v, sub]) => (
            <div key={l} className="px-4 py-3"><p className="text-[12.5px] text-[rgb(var(--muted))]">{l}</p><p className="text-[22px] font-medium leading-7 tabular-nums">{v}</p><p className="text-xs text-[rgb(var(--muted))]">{sub}</p></div>
          ))}
        </div>
        <SetBlock title="Hạng mục chi" sub={`${mktItems.length} hạng mục`}>
        <CatalogTable<MktItem>
          rows={mktItems}
          rowKey={(r) => r.id}
          entity="hạng mục chi"
          canEdit={canEdit}
          columns={[
            { label: 'Hạng mục', render: (r) => r.name },
            { label: 'Kênh lead', render: (r) => (r.source ? SOURCE_LABEL[r.source] : '—') },
            { label: 'Kế hoạch', render: (r) => <span className="tabular-nums">{compact(r.planned)}</span> },
            { label: 'Đã chi', render: (r) => <span className="tabular-nums">{compact(r.spent)}</span> },
            { label: '% dùng', render: (r) => { const p0 = r.planned ? Math.round((r.spent / r.planned) * 100) : 0; return <span className="flex items-center gap-2"><span className="h-1.5 w-20 overflow-hidden rounded-full bg-[rgb(var(--ink)/0.08)]"><span className={cn('block h-full rounded-full', p0 > 90 ? 'bg-[rgb(var(--accent))]' : 'bg-[rgb(var(--fg))]')} style={{ width: `${Math.min(100, p0)}%` }} /></span><span className="font-mono text-xs tabular-nums text-[rgb(var(--fg2))]">{p0}%</span></span>; } },
            { label: 'CPL', render: (r) => { const n = r.source ? leads.filter((l) => l.source === r.source).length : 0; return <span className="tabular-nums" title={r.source ? `${n} lead từ kênh ${SOURCE_LABEL[r.source]}` : 'Chưa gắn kênh lead'}>{n ? compact(r.spent / n) : '—'}</span>; } },
          ]}
          fields={[
            { key: 'name', label: 'Tên hạng mục', type: 'text', wide: true },
            { key: 'source', label: 'Kênh lead tương ứng', type: 'select', options: sourceOpts, hint: 'Để tính CPL và ROI theo kênh' },
            { key: 'planned', label: 'Kế hoạch năm', type: 'money' },
            { key: 'spent', label: 'Đã chi thực tế', type: 'money' },
          ]}
          blank={() => ({ name: '', source: '', planned: 0, spent: 0 })}
          toForm={(r) => ({ ...r })}
          fromForm={(v, prev) => ({ id: prev?.id ?? uid('mk'), name: String(v.name).trim(), source: String(v.source ?? '') as Source | '', planned: Number(v.planned), spent: Number(v.spent) })}
          validate={(v) => {
            const e: Record<string, string> = {};
            if (String(v.name ?? '').trim().length < 3) e.name = 'Tối thiểu 3 ký tự';
            if (Number(v.planned) <= 0) e.planned = 'Nhập kế hoạch';
            if (Number(v.spent) < 0) e.spent = 'Không âm';
            return e;
          }}
          onSave={(row, prev) => { setMktItems((p) => (prev ? p.map((x) => (x.id === prev.id ? row : x)) : [...p, row])); notify('Đã lưu hạng mục chi Marketing', 'teal'); }}
          onDelete={(r) => removeWithUndo(setMktItems, r, notify, `Đã xóa ${r.name}`)}
        />
        </SetBlock>
        <p className="flex items-center gap-2 px-1 text-xs text-[rgb(var(--muted))]"><AlertTriangle className="h-3.5 w-3.5" aria-hidden />Ngân sách do {company.shortName || 'doanh nghiệp'} tự chi, không thuộc quỹ MDF / CS của Hãng. CPL và ROI tính theo kênh lead gắn với từng hạng mục.</p>
      </div>
      <div className="min-w-0 space-y-4"><MktAllocAi items={mktItems} leads={leads} /></div>
    </div>
  );
}

/** AI gợi ý phân bổ ngân sách kỳ tới theo CPL và tỷ lệ chốt của từng kênh (chỉ gợi ý) */
export function MktAllocAi({ items, leads }: { items: MktItem[]; leads: Lead[] }) {
  const ai = useAi('copilot');
  const { notify } = useApp();
  const [res, setRes] = useState<CheckItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const data = items.map((i) => { const ls = i.source ? leads.filter((l) => l.source === i.source) : []; const won = ls.filter((l) => l.status === 'WON'); return `${i.name}: kế hoạch ${compact(i.planned)}, đã chi ${compact(i.spent)}, ${ls.length} lead, ${won.length} đơn chốt, doanh thu ${compact(won.reduce((a, l) => a + (l.wonAmount ?? 0), 0))}`; }).join('\n');
    const r = await ai.ask({ maxTokens: 700, prompt: `Dựa trên số liệu ngân sách Marketing theo kênh dưới đây, gợi ý tối đa 4 điều chỉnh phân bổ cho kỳ tới (tăng / giảm bao nhiêu, vì sao theo CPL và tỷ lệ chốt). Chỉ dùng số liệu được cung cấp.\nTrả JSON: {"items":[{"level":"up|down|keep","title":"...","detail":"..."}]}\n${data}` });
    setBusy(false);
    if (!r.ok) return notify(r.error, 'orange');
    const d = parseAiJson<{ items?: { level: string; title: string; detail: string }[] }>(r.text);
    setRes((d?.items ?? []).slice(0, 4).map((x) => ({ tone: x.level === 'up' ? 'teal' : x.level === 'down' ? 'orange' : 'teal', title: x.title, detail: x.detail })));
  };
  return (
    <SideCard title="Gợi ý phân bổ ngân sách" sub="dựa trên lead và đơn chốt">
      {res ? (res.length ? <CheckList items={res} /> : <p className="text-xs text-[rgb(var(--muted))]">AI không trả về gợi ý.</p>) : <p className="text-xs text-[rgb(var(--muted))]">AI đọc chi phí, số lead và đơn chốt của từng kênh để gợi ý tăng / giảm. Chỉ gợi ý, không tự đổi ngân sách.</p>}
      <button type="button" className={cn(btnGhost, btnSm, 'mt-3')} disabled={!ai.available || busy || !items.length} onClick={() => void run()} title={ai.available ? '' : 'Cần bật trợ lý AI'}>{busy ? 'Đang phân tích…' : res ? 'Phân tích lại' : 'Gợi ý bằng AI'}</button>
    </SideCard>
  );
}

