'use client';

import { Coins, Megaphone, Target, Wallet } from 'lucide-react';
import { removeWithUndo } from '../../app/context';
import { CatalogTable, Collapse } from '../../components/crud';
import { ProgressBar, StatCard } from '../../components/ui';
import { C, compact, kpiGrid, pct, SOURCE_LABEL, uid, useApp } from '../../lib/core';
import type { MktItem, Opt, Source } from '../../lib/types';

// =====================================================================
//  CÀI ĐẶT: NGÂN SÁCH MARKETING NỘI BỘ (tách khỏi quỹ 3M)
// =====================================================================

export function MarketingBudgetSettings() {
  const { mktItems, setMktItems, canDo, notify, leads } = useApp();
  const canEdit = canDo('settings.edit') || canDo('lead.create');
  const planned = mktItems.reduce((s, i) => s + i.planned, 0);
  const spent = mktItems.reduce((s, i) => s + i.spent, 0);
  const sourceOpts: Opt[] = [{ value: '', label: 'Không gắn kênh lead' }, ...(Object.keys(SOURCE_LABEL) as Source[]).map((s) => ({ value: s, label: SOURCE_LABEL[s] }))];
  return (
    <div className="space-y-5">
      <p className="flex items-start gap-2 rounded border border-[rgb(var(--line))] bg-[rgb(var(--raised))] px-4 py-3 text-sm text-[rgb(var(--muted))]">
        <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--accent))]" aria-hidden />
        Ngân sách Marketing do VASSH tự chi, không thuộc quỹ MDF / CS của 3M. Chi phí thực tế ở đây dùng tính CPL, chi phí trên mỗi đơn chốt và ROI Marketing trong Báo cáo.
      </p>
      <div className={kpiGrid('lg:grid-cols-3')}>
        <StatCard label="Kế hoạch năm" value={compact(planned)} icon={Wallet} />
        <StatCard label="Đã chi" value={compact(spent)} sub={pct(spent, planned) + ' kế hoạch'} icon={Coins} color={C.orange} />
        <StatCard label="Chi phí / lead" value={leads.length ? compact(spent / leads.length) : '—'} sub={`${leads.length} lead trong hệ thống`} icon={Target} />
      </div>
      <Collapse title="Hạng mục chi Marketing" summary={`${mktItems.length} hạng mục`}>
        <CatalogTable<MktItem>
          rows={mktItems}
          rowKey={(r) => r.id}
          entity="hạng mục chi"
          canEdit={canEdit}
          columns={[
            { label: 'Hạng mục', render: (r) => r.name },
            { label: 'Kênh lead', render: (r) => (r.source ? SOURCE_LABEL[r.source] : '—') },
            { label: 'Kế hoạch', render: (r) => <span className="tabular-nums">{compact(r.planned)}</span> },
            { label: 'Đã chi', render: (r) => <div className="w-36"><ProgressBar value={r.spent} max={r.planned} /><p className="mt-1 text-xs tabular-nums text-[rgb(var(--muted))]">{compact(r.spent)}</p></div> },
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
      </Collapse>
    </div>
  );
}

