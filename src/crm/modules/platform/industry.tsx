'use client';

// v56 3A Console › Doanh nghiệp › Ngành & mẫu ngành: chọn ngành, xem trước bộ mẫu, "Áp dụng bộ mẫu ngành" (nhân bản trường + bố cục
// thành bản riêng của doanh nghiệp), mở Studio để tinh chỉnh riêng; sửa từ điển thuật ngữ của ngành (lưu _platform/industryProfiles).
import { useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, LayoutTemplate, Lock } from 'lucide-react';
import { Chip, Code, Field, SideSheet } from '../../components/ui';
import { btnGhost, btnPrimary, btnSm, CF_ENTITY, CF_TYPE, inputCls, L_PAGES, orgOf, useApp } from '../../lib/core';
import { INDUSTRY_BUILTIN, industryProfilesEff, planIndustryClone, TERM_KEYS, tenantIndustry, useApplyIndustry } from '../../lib/industry';
import type { IndustryCode, IndustryProfile } from '../../lib/types';
import { cn } from '../../lib/utils';

const TONE_DOT: Record<string, string> = { muted: 'bg-[rgb(var(--muted))]', orange: 'bg-[rgb(var(--accent))]', teal: 'bg-[rgb(var(--success))]', red: 'bg-[rgb(var(--danger))]', blue: 'bg-[rgb(var(--secondary))]' };

export function IndustrySheet({ tenantId, onClose, who }: { tenantId: string; onClose: () => void; who: string }) {
  const { platform, notify } = useApp();
  const o = orgOf(tenantId);
  const reg = platform.tenants.find((t) => t.id === tenantId);
  const cur = tenantIndustry(reg, o);
  const profiles = industryProfilesEff(platform.industryProfiles);
  const [code, setCode] = useState<IndustryCode>(cur);
  const [terms, setTerms] = useState(false);
  const [okReplace, setOkReplace] = useState(false);
  const p = profiles.find((x) => x.id === code)!;
  const apply = useApplyIndustry();
  const plan = useMemo(() => planIndustryClone(p, tenantId, { cf: platform.customFields, layouts: platform.layouts, assigns: platform.layoutAssigns }, who), [p, tenantId, platform.customFields, platform.layouts, platform.layoutAssigns, who]);
  // Bố cục riêng hiện có của doanh nghiệp (để mở Studio)
  const own = L_PAGES.filter((pg) => pg.open).map((pg) => {
    const a = platform.layoutAssigns.find((x) => x.page === pg.id && x.level === 'TENANT' && x.tenantId === tenantId && !x.role);
    const v = a ? platform.layouts.find((x) => x.id === a.verId) : undefined;
    const draft = platform.layouts.find((x) => x.page === pg.id && x.tenantId === tenantId && x.status === 'DRAFT');
    return { pg, v, draft };
  }).filter((x) => x.v?.tenantId === tenantId || x.draft);
  const studio = (page: string, verId: string) => { location.hash = `#/console/design/${page}/${verId}`; };
  const doApply = () => {
    const r = apply(code, tenantId, who);
    if (!r) return;
    notify(`Đã áp dụng bộ mẫu ${p.label} cho ${o.shortName}: ${r.fields.length} trường, ${r.layouts.length} bố cục riêng`, 'teal');
    setOkReplace(false);
  };
  const saveCode = () => { platform.setTenantReg(tenantId, { industry: code }, `Đặt ngành ${p.label}`); notify(`Đã đặt ngành ${p.label} cho ${o.shortName}`, 'teal'); };
  return (
    <SideSheet title={`Ngành & mẫu ngành: ${o.shortName}`} sub={reg?.industryApplied ? `Đã áp dụng ${profiles.find((x) => x.id === reg.industryApplied!.code)?.label ?? reg.industryApplied.code} ${new Date(reg.industryApplied.at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'Chưa áp dụng bộ mẫu ngành'} onClose={onClose} width="sm:w-[520px]"
      footer={<div className="flex w-full items-center gap-2">
        <button className={btnGhost} disabled={code === reg?.industry} onClick={saveCode}>Chỉ đặt ngành</button>
        {plan.replaced.length > 0 && p.ready && <label className="ml-auto flex items-center gap-1.5 text-[12.5px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={okReplace} onChange={(e) => setOkReplace(e.target.checked)} />Thay {plan.replaced.length} bố cục riêng</label>}
        <button className={cn(btnPrimary, !(plan.replaced.length > 0 && p.ready) && 'ml-auto')} disabled={!p.ready || (!plan.fields.length && !plan.layouts.length) || (plan.replaced.length > 0 && !okReplace)} onClick={doApply}><LayoutTemplate className="h-4 w-4" aria-hidden />{plan.replaced.length ? 'Áp dụng lại' : 'Áp dụng bộ mẫu ngành'}</button>
      </div>}>
      <div className="space-y-5">
        <Field label="Ngành nghề">
          <select className={inputCls} value={code} onChange={(e) => setCode(e.target.value as IndustryCode)} aria-label="Ngành nghề">
            {profiles.map((x) => <option key={x.id} value={x.id}>{x.label}{x.ready ? '' : ' (hạ tầng)'}{x.id === cur ? ' · đang dùng' : ''}</option>)}
          </select>
        </Field>
        <p className="-mt-3 text-[12.5px] text-[rgb(var(--muted))]">{p.desc}</p>

        <section aria-label="Thuật ngữ">
          <div className="mb-1.5 flex items-center"><h3 className="text-[13.5px] font-medium">Thuật ngữ</h3><button className="ml-auto text-[12.5px] text-[rgb(var(--accent-fg))] hover:underline" onClick={() => setTerms(!terms)}>{terms ? 'Đóng' : 'Sửa thuật ngữ ngành'}</button></div>
          {terms ? <TermsEditor p={p} who={who} onDone={() => setTerms(false)} /> : (
            <dl className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1 text-[13px]">
              {TERM_KEYS.slice(0, 5).map((k) => <div key={k.key} className="contents"><dt className="text-[rgb(var(--muted))]">{k.label}</dt><dd className="truncate">{p.terms[k.key] || k.def}</dd></div>)}
            </dl>
          )}
        </section>

        <section aria-label="Quy trình trạng thái">
          <h3 className="mb-1.5 text-[13.5px] font-medium">Quy trình trạng thái</h3>
          <ol className="flex flex-wrap items-center gap-1.5 text-[12.5px]">{p.workflowStates.map((s, i) => <li key={s.id} className="flex items-center gap-1.5">{i > 0 && <span className="text-[rgb(var(--faint))]">›</span>}<span className="inline-flex items-center gap-1.5 rounded-md border border-[rgb(var(--line))] px-2 py-0.5"><i className={cn('h-1.5 w-1.5 rounded-full', TONE_DOT[s.tone])} />{s.label}</span></li>)}</ol>
          <p className="mt-1.5 text-[12px] text-[rgb(var(--muted))]">Loại tài nguyên: {p.resourceKinds.map((k) => k.label).join(', ') || '—'} · doanh nghiệp tự khai báo ở Cài đặt › Tài nguyên</p>
        </section>

        {!p.ready ? (
          <p className="flex gap-2 rounded-lg bg-[rgb(var(--ink)/0.04)] px-3 py-2.5 text-[12.5px] text-[rgb(var(--fg2))]"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />Ngành này mới có hạ tầng (thuật ngữ, trạng thái, loại tài nguyên). Bộ trường và bố cục mẫu sẽ có ở bản sau; "Chỉ đặt ngành" để doanh nghiệp dùng thuật ngữ ngành ngay.</p>
        ) : (<>
          <section aria-label="Trường mẫu">
            <h3 className="mb-1.5 text-[13.5px] font-medium">Trường mẫu <span className="font-normal text-[rgb(var(--muted))]">· {plan.fields.length} trường mới{plan.skipped.length ? `, ${plan.skipped.length} bỏ qua` : ''}</span></h3>
            <ul className="divide-y divide-[rgb(var(--line)/0.6)] rounded-lg border border-[rgb(var(--line))] text-[13px]">
              {p.cfTemplates.map((t) => { const sk = plan.skipped.find((s) => s.key === t.key); return (
                <li key={`${t.entity}-${t.key}`} className="flex items-center gap-2 px-3 py-1.5" data-tpl-field={t.key}>
                  <span className="min-w-0 flex-1 truncate">{t.label}</span>
                  <span className="shrink-0 text-[12px] text-[rgb(var(--muted))]">{CF_ENTITY[t.entity]} · {CF_TYPE[t.type]}</span>
                  {sk ? <Chip tone="muted">Bỏ qua</Chip> : <Chip tone="teal">Mới</Chip>}
                </li>
              ); })}
            </ul>
            {plan.skipped.length > 0 && <p className="mt-1 text-[12px] text-[rgb(var(--muted))]">Bỏ qua: {plan.skipped.map((s) => `${s.label} (${s.why})`).join('; ')}</p>}
          </section>
          <section aria-label="Bố cục mẫu">
            <h3 className="mb-1.5 text-[13.5px] font-medium">Bố cục mẫu <span className="font-normal text-[rgb(var(--muted))]">· phát hành riêng cho {o.shortName}</span></h3>
            <ul className="space-y-1 text-[13px]">{p.layoutTemplates.map((l) => { const rep = plan.replaced.find((a) => a.page === l.page); return (
              <li key={l.page} className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-[rgb(var(--success))]" aria-hidden /><span className="flex-1">{L_PAGES.find((x) => x.id === l.page)?.label ?? l.page}</span><span className="text-[12px] text-[rgb(var(--muted))]">{l.blocks.length} khối{rep ? ' · thay bố cục riêng đang dùng' : ''}</span></li>
            ); })}</ul>
          </section>
        </>)}

        {own.length > 0 && (
          <section aria-label="Bố cục riêng" className="border-t border-[rgb(var(--line))] pt-4">
            <h3 className="mb-1.5 text-[13.5px] font-medium">Bố cục riêng của {o.shortName}</h3>
            <p className="mb-2 text-[12px] text-[rgb(var(--muted))]">Mở Studio để kéo thả tinh chỉnh; bản nháp và phát hành chỉ ảnh hưởng doanh nghiệp này</p>
            <ul className="space-y-1.5">{own.map(({ pg, v, draft }) => (
              <li key={pg.id} className="flex items-center gap-2 text-[13px]">
                <span className="flex-1">{pg.label}</span>
                {v && <Code>v{v.version}</Code>}{draft && <Chip tone="orange">Nháp v{draft.version}</Chip>}
                <button className={cn(btnGhost, btnSm)} onClick={() => studio(pg.id, draft?.id ?? v?.id ?? `new@${tenantId}`)}><ExternalLink className="h-3.5 w-3.5" aria-hidden />Mở Studio</button>
              </li>
            ))}</ul>
          </section>
        )}
      </div>
    </SideSheet>
  );
}

/** Sửa từ điển thuật ngữ của một ngành (bản 3A lưu thắng bản có sẵn) */
function TermsEditor({ p, who, onDone }: { p: IndustryProfile; who: string; onDone: () => void }) {
  const { platform, notify } = useApp();
  const [t, setT] = useState<Record<string, string>>({ ...p.terms });
  const builtin = INDUSTRY_BUILTIN.find((x) => x.id === p.id);
  const save = () => {
    const clean = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
    const next: IndustryProfile = { ...p, terms: clean, at: Date.now(), by: who };
    platform.setIndustryProfiles((all) => (all.some((x) => x.id === p.id) ? all.map((x) => (x.id === p.id ? next : x)) : [...all, next]));
    platform.log('INDUSTRY_TERMS', `${p.label}: cập nhật thuật ngữ (${Object.keys(clean).length} khóa)`);
    notify(`Đã lưu thuật ngữ ngành ${p.label}`, 'teal');
    onDone();
  };
  return (
    <div className="space-y-2">
      {TERM_KEYS.map((k) => <label key={k.key} className="grid grid-cols-[150px_1fr] items-center gap-3 text-[13px]"><span className="text-[rgb(var(--muted))]">{k.label}</span><input className={inputCls} value={t[k.key] ?? ''} placeholder={builtin?.terms[k.key] || k.def} onChange={(e) => setT({ ...t, [k.key]: e.target.value })} aria-label={k.label} /></label>)}
      <div className="flex gap-2 pt-1"><button className={cn(btnGhost, btnSm)} onClick={() => setT({ ...(builtin?.terms ?? {}) })}>Về mặc định</button><button className={cn(btnPrimary, btnSm, 'ml-auto')} onClick={save}>Lưu thuật ngữ</button></div>
    </div>
  );
}
