'use client';

import { CheckCircle2, Lock } from 'lucide-react';
import { Chip, Panel, Table } from '../../components/ui';
import { scoreLead } from '../../lib/business';
import { boqTotal, BUSINESS_PROFILE, compact, CORE_MODULES, MODULE_ICON, MODULE_LABEL, moduleEnabled, MODULES, MQL_THRESHOLD, pct, rowCls, SOURCE_LABEL, tdCls, tdFirst, tdLast, useApp } from '../../lib/core';
import type { BusinessProfile, Lead, Module, Source } from '../../lib/types';
import { cn } from '../../lib/utils';

// =====================================================================
//  PHÂN HỆ 7: CÀI ĐẶT & CẤU HÌNH HỆ THỐNG
// =====================================================================

// ---- Chỉ số đo lường Marketing: chi phí nội bộ (tách khỏi quỹ 3M) so với lead, đơn chốt, doanh số ----
export function MarketingMetrics({ leads, mktRev }: { leads: Lead[]; mktRev: number }) {
  const { mktItems, customers } = useApp();
  const spent = mktItems.reduce((s, i) => s + i.spent, 0);
  const mql = leads.filter((l) => (l.score ?? scoreLead(l, customers)) >= MQL_THRESHOLD).length;
  const won = leads.filter((l) => l.status === 'WON');
  const wonValue = won.reduce((s, l) => s + boqTotal(l), 0);
  const slaDone = leads.filter((l) => l.slaMet !== undefined);

  const paidSources = new Set(mktItems.map((i) => i.source).filter(Boolean) as Source[]);
  const channelRows = (Object.keys(SOURCE_LABEL) as Source[]).map((src) => {
    const cost = mktItems.filter((i) => i.source === src).reduce((s, i) => s + i.spent, 0);
    const ls = leads.filter((l) => l.source === src);
    const w = ls.filter((l) => l.status === 'WON');
    const value = w.reduce((s, l) => s + boqTotal(l), 0);
    return { src, cost, leads: ls.length, won: w.length, value, cpl: cost && ls.length ? cost / ls.length : null, roi: cost ? value / cost : null };
  }).filter((r) => r.leads > 0 || r.cost > 0).sort((a, b) => b.value - a.value);

  const kpis: [string, string, string][] = [
    ['Chi phí MKT', compact(spent), `Ngân sách nội bộ, ${mktItems.length} hạng mục`],
    ['Lead nhận / MQL', `${leads.length} / ${mql}`, `Tỷ lệ MQL ${pct(mql, leads.length)}`],
    ['CPL', leads.length ? compact(spent / leads.length) : '—', `Mỗi MQL ${mql ? compact(spent / mql) : '—'}`],
    ['Lead thành đơn', pct(won.length, leads.length), `${won.length} đơn chốt`],
    ['Chi phí / đơn', won.length ? compact(spent / won.length) : '—', `Giá trị chốt ${compact(wonValue)}`],
    ['Đúng SLA 2h', pct(slaDone.filter((l) => l.slaMet).length, slaDone.length), `${slaDone.length} lead đã tiếp nhận`],
    ['Doanh số MKT', compact(mktRev), 'Theo nguồn khách hàng có cờ Marketing'],
    ['ROI Marketing', spent ? `${(mktRev / spent).toFixed(1)} lần` : '—', `Giá trị chốt / chi phí ${spent ? (wonValue / spent).toFixed(1) : '—'} lần`],
  ];

  return (
    <Panel title="Chỉ số đo lường Marketing">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(([k, v, sub]) => (
          <div key={k} className="rounded bg-[rgb(var(--raised))] p-3">
            <p className="text-xs text-[rgb(var(--muted))]">{k}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{v}</p>
            <p className="hidden text-xs text-[rgb(var(--muted))] sm:block">{sub}</p>
          </div>
        ))}
      </div>
      <h3 className="mb-2 mt-5 text-sm font-semibold">Hiệu quả theo kênh</h3>
      <Table head={['Kênh', 'Chi phí', 'Lead', 'CPL', 'Chốt đơn', 'Giá trị chốt', 'ROI kênh']} minW={760}>
        {channelRows.map((r) => (
          <tr key={r.src} className={rowCls}>
            <td className={tdFirst}>{SOURCE_LABEL[r.src]}{!paidSources.has(r.src) && <span className="ml-2 text-xs text-[rgb(var(--muted))]">không tốn phí</span>}</td>
            <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{r.cost ? compact(r.cost) : '—'}</td>
            <td className={cn(tdCls, 'tabular-nums')}>{r.leads}</td>
            <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{r.cpl ? compact(r.cpl) : '—'}</td>
            <td className={cn(tdCls, 'tabular-nums')}>{r.won}</td>
            <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{r.value ? compact(r.value) : '—'}</td>
            <td className={tdLast}>{r.roi !== null ? <Chip tone={r.roi >= 5 ? 'teal' : r.roi >= 1 ? 'orange' : 'red'}>{r.roi.toFixed(1)} lần</Chip> : <span className="text-xs text-[rgb(var(--muted))]">—</span>}</td>
          </tr>
        ))}
      </Table>
      <p className="mt-3 text-xs text-[rgb(var(--muted))]">Chi phí lấy từ Cài đặt &gt; Ngân sách Marketing (hạng mục gắn kênh lead). Giá trị chốt lấy theo BOQ bóc tách, chưa có BOQ thì theo ước tính. Quỹ MDF / CS của 3M không tính vào chi phí Marketing.</p>
    </Panel>
  );
}

// =====================================================================
//  PHÂN HỆ 8: CÀI ĐẶT & CẤU HÌNH HỆ THỐNG
// =====================================================================

// =====================================================================
//  CÀI ĐẶT: PHÂN HỆ SỬ DỤNG (gói theo mô hình doanh nghiệp)
// =====================================================================

export function BusinessModulesPanel() {
  const { company, setCompany, notify, audit, org } = useApp();
  /** Gói phân hệ do nền tảng 3A Group cố định theo doanh nghiệp, không đổi tại đây */
  const canEdit = false;
  const profile = company.profile ?? 'TRADING';
  const optional = MODULES.filter((m) => !CORE_MODULES.includes(m));
  const pick = (p: BusinessProfile) => {
    setCompany((c) => ({ ...c, profile: p, enabledModules: p === 'CUSTOM' ? Object.fromEntries(optional.map((m) => [m, moduleEnabled(c, m)])) : c.enabledModules }));
    audit('MODULES_PROFILE', `Đổi gói phân hệ sang "${BUSINESS_PROFILE[p].label}"`, 'WARN');
    notify(`Đã áp dụng gói "${BUSINESS_PROFILE[p].label}". Dữ liệu các phân hệ đang tắt vẫn được giữ nguyên.`, 'teal');
  };
  const toggle = (m: Module) => setCompany((c) => ({ ...c, profile: 'CUSTOM', enabledModules: { ...Object.fromEntries(optional.map((x) => [x, moduleEnabled(c, x)])), [m]: !moduleEnabled(c, m) } }));
  const shared: Module[] = ['leads', 'customers', 'staff', 'docs', 'reports'];
  return (
    <Panel title="Phân hệ sử dụng">
      <p className="mb-3 flex items-start gap-2 rounded border border-[rgb(var(--accent)/0.3)] bg-[rgb(var(--accent)/0.05)] px-3 py-2 text-sm text-[rgb(var(--accent-fg))]"><Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{org.shortName} dùng gói "{BUSINESS_PROFILE[org.profile].label}", do nền tảng 3A Group cố định: {org.profile === 'TRADING' ? 'ẩn hoàn toàn các phân hệ xưởng' : 'ẩn hoàn toàn các phân hệ quỹ Hãng'}. Dữ liệu hai doanh nghiệp lưu tách riêng.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(BUSINESS_PROFILE) as BusinessProfile[]).filter((p) => p === profile).map((p) => (
          <button key={p} disabled={!canEdit} onClick={() => pick(p)} className={cn('rounded-md border p-3 text-left transition-colors disabled:opacity-60', profile === p ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.1)]' : 'border-[rgb(var(--line))] hover:bg-[rgb(var(--raised))]')}>
            <p className="flex items-center gap-2 text-sm font-semibold">{profile === p && <CheckCircle2 className="h-4 w-4 text-[rgb(var(--accent))]" aria-hidden />}{BUSINESS_PROFILE[p].label}</p>
            <p className="mt-1 text-xs text-[rgb(var(--muted))]">{BUSINESS_PROFILE[p].desc}</p>
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { title: 'Dùng chung', list: [...CORE_MODULES, ...shared] },
          { title: 'Thương mại & phân phối', list: ['projects', 'products', 'supply', 'claims'] as Module[] },
          { title: 'Sản xuất & lắp đặt', list: ['jobs', 'production', 'install', 'inventory'] as Module[] },
          { title: 'Kế toán', list: ['cashbook'] as Module[] },
        ].map((g) => (
          <div key={g.title} className="rounded-md border border-[rgb(var(--line))] p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--muted))]">{g.title}</p>
            <ul className="space-y-1">
              {g.list.map((m) => {
                const Icon = MODULE_ICON[m];
                const on = moduleEnabled(company, m);
                const core = CORE_MODULES.includes(m);
                return (
                  <li key={m}>
                    <label className={cn('flex items-center gap-2 rounded px-2 py-1.5 text-sm', !core && canEdit && 'cursor-pointer hover:bg-[rgb(var(--raised))]')}>
                      <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={on} disabled={core || !canEdit} onChange={() => toggle(m)} />
                      <Icon className={cn('h-4 w-4', on ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--muted))]')} aria-hidden />
                      <span className={on ? '' : 'text-[rgb(var(--muted))]'}>{MODULE_LABEL[m]}</span>
                      {core && <span className="ml-auto text-[10px] text-[rgb(var(--muted))]">luôn bật</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}

