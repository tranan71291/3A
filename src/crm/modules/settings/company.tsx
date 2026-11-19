'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ImagePlus, RefreshCw, Sparkles, Trash2, Upload } from 'lucide-react';
import { Field, FilePicker, Panel } from '../../components/ui';
import { bizMode, btnGhost, btnPrimary, btnSm, compact, COMPANY_AI_FIELDS, EMAIL_RE, fileB64, initials, inputCls, MST_RE, shrinkImage, useApp } from '../../lib/core';
import type { CompanyInfo, SettingsTab } from '../../lib/types';
import { cn } from '../../lib/utils';
import { parseAiJson, useAi, useServerStatus } from '../ai/ai-core';

// =====================================================================
//  CÀI ĐẶT: THÔNG TIN DOANH NGHIỆP & LOGO
// =====================================================================

export function BrandMark({ size = 32 }: { size?: number }) {
  const { company } = useApp();
  return company.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={company.logo} alt={company.shortName} style={{ width: size, height: size }} className="shrink-0 rounded bg-white object-contain p-0.5" />
  ) : (
    <span style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded bg-[rgb(var(--accent))] text-xs font-semibold text-[rgb(var(--on-accent))]">{initials(company.shortName || company.appName)}</span>
  );
}

export function CompanySettings() {
  const { company, setCompany, canDo, notify } = useApp();
  const canEdit = canDo('settings.edit');
  const [f, setF] = useState(company);
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof CompanyInfo>(k: K, v: CompanyInfo[K]) => setF((p) => ({ ...p, [k]: v }));
  const e: Partial<Record<keyof CompanyInfo, string>> = {};
  if (f.appName.trim().length < 2) e.appName = 'Nhập tên hệ thống';
  if (f.legalName.trim().length < 5) e.legalName = 'Nhập tên pháp lý';
  if (f.taxCode && !MST_RE.test(f.taxCode)) e.taxCode = 'MST gồm 10 hoặc 13 số';
  if (f.email && !EMAIL_RE.test(f.email)) e.email = 'Email chưa đúng';
  const err = (k: keyof CompanyInfo) => (touched ? e[k] : undefined);

  const pickLogo = (files: File[]) => {
    const file = files[0];
    if (!file.type.startsWith('image/')) return notify('Chọn file ảnh (PNG, JPG, SVG)', 'red');
    if (file.size > 1024 * 1024) return notify('Logo tối đa 1 MB', 'red');
    const reader = new FileReader();
    reader.onload = () => set('logo', String(reader.result));
    reader.onerror = () => notify('Không đọc được file ảnh', 'red');
    reader.readAsDataURL(file);
  };
  const save = () => {
    setTouched(true);
    if (Object.keys(e).length) return;
    setCompany({ ...f, appName: f.appName.trim(), legalName: f.legalName.trim(), shortName: f.shortName.trim() || f.appName.trim() });
    notify('Đã lưu thông tin doanh nghiệp', 'teal');
  };

  const dirty = JSON.stringify(f) !== JSON.stringify(company);
  const inp = (k: keyof CompanyInfo, label: string, cls = '', type = 'text') => (
    <Field label={label} error={err(k)} className={cls}>
      <input className={inputCls} disabled={!canEdit} type={type} inputMode={type === 'tel' ? 'tel' : undefined} autoComplete={type === 'tel' ? 'tel' : type === 'email' ? 'email' : undefined} spellCheck={type === 'email' ? false : undefined}
        value={String(f[k] ?? '')} onChange={(ev) => set(k, ev.target.value as never)} />
    </Field>
  );
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px] xl:items-start">
      <div className="min-w-0 space-y-4">
        <Panel title="Thông tin chung">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[160px_1fr]">
            <div>
              <p className="mb-1.5 text-xs text-[rgb(var(--muted))]">Logo</p>
              <FilePicker accept="image/png,image/jpeg,image/svg+xml,image/webp" onFiles={pickLogo} disabled={!canEdit} className="flex aspect-square w-full max-w-[160px] items-center justify-center overflow-hidden rounded-lg border border-dashed border-[rgb(var(--line))] bg-[rgb(var(--sunken))]">
                {f.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.logo} alt="Logo doanh nghiệp" className="h-full w-full bg-white object-contain p-3" />
                ) : (
                  <span className="flex flex-col items-center gap-2 text-xs text-[rgb(var(--muted))]"><ImagePlus className="h-6 w-6" aria-hidden />Tải logo, tối đa 1 MB</span>
                )}
              </FilePicker>
              {f.logo && <button className={cn(btnGhost, btnSm, 'mt-2')} disabled={!canEdit} onClick={() => set('logo', undefined)}><Trash2 className="h-3.5 w-3.5" aria-hidden />Gỡ logo</button>}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {inp('appName', 'Tên hệ thống')}
              {inp('shortName', 'Tên viết tắt')}
              {inp('legalName', 'Tên pháp lý', 'sm:col-span-2')}
              {inp('taxCode', 'Mã số thuế')}
              {inp('phone', 'Điện thoại', '', 'tel')}
              {inp('address', 'Địa chỉ trụ sở', 'sm:col-span-2')}
              {inp('email', 'Email', '', 'email')}
              {inp('website', 'Website')}
            </div>
          </div>
        </Panel>
        <Panel title={<span>Đại diện và ngân hàng <span className="ml-2 font-mono text-xs font-normal text-[rgb(var(--muted))]">{'{{company_rep}}'} · {'{{company_bank}}'}</span></span>}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {inp('representative', 'Người đại diện ký báo giá / hợp đồng')}
            {inp('representativeTitle', 'Chức vụ')}
            {inp('bankAccount', 'Số tài khoản')}
            {inp('bankName', 'Ngân hàng, chi nhánh')}
          </div>
        </Panel>
        <Panel title="Mộc và chữ ký">
          <div className="flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {f.stamp ? <img src={f.stamp} alt="Mộc và chữ ký" className="h-20 rounded bg-white object-contain p-1" /> : null}
            <FilePicker accept="image/png,image/jpeg,image/webp" disabled={!canEdit} onFiles={(files) => { const file = files[0]; if (!file.type.startsWith('image/') || file.size > 1024 * 1024) return notify('Chọn ảnh PNG / JPG tối đa 1 MB', 'red'); const r = new FileReader(); r.onload = () => set('stamp', String(r.result)); r.readAsDataURL(file); }}
              className="flex h-20 w-52 items-center justify-center gap-2 rounded-lg border border-dashed border-[rgb(var(--line))] text-xs text-[rgb(var(--muted))]">
              <Upload className="h-4 w-4" aria-hidden />{f.stamp ? 'Đổi ảnh mộc / chữ ký' : 'Tải ảnh mộc / chữ ký'}
            </FilePicker>
            {f.stamp && <button className={cn(btnGhost, btnSm)} disabled={!canEdit} onClick={() => set('stamp', undefined)}>Gỡ ảnh</button>}
            <p className="min-w-[200px] flex-1 text-xs text-[rgb(var(--muted))]">Ảnh PNG nền trong. Chèn vào {'{{company_stamp}}'} trên bản in, không thay thế chữ ký số.</p>
          </div>
        </Panel>
        {dirty && canEdit && <SaveBar onCancel={() => { setF(company); setTouched(false); }} onSave={save} error={touched && Object.keys(e).length ? Object.values(e)[0] : undefined} />}
      </div>
      <aside className="min-w-0 space-y-4 xl:sticky xl:top-20">
        <CompanyPrintPreview c={f} />
        {canEdit && <CompanyAiFill current={f} onApply={(p) => setF((x) => ({ ...x, ...p }))} />}
      </aside>
    </div>
  );
}

/** v42: thanh "Có thay đổi chưa lưu" dùng chung cho các form Cài đặt */
export function SaveBar({ onCancel, onSave, error, label = 'Có thay đổi chưa lưu' }: { onCancel: () => void; onSave: () => void; error?: string; label?: string }) {
  return (
    <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-4 py-2.5 text-[13px] shadow-[var(--shadow-md)]" role="status">
      <AlertTriangle className={cn('h-4 w-4', error ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--muted))]')} aria-hidden />
      <span className={error ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--fg2))]'}>{error ?? label}</span>
      <span className="ml-auto flex gap-2"><button className={cn(btnGhost, btnSm)} onClick={onCancel}>Hủy</button><button className={cn(btnPrimary, btnSm)} onClick={onSave}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />Lưu</button></span>
    </div>
  );
}

/** v42: bản in mẫu đầu trang báo giá, cập nhật ngay khi sửa thông tin doanh nghiệp (giấy trắng ở cả giao diện tối) */
export function CompanyPrintPreview({ c }: { c: CompanyInfo }) {
  const miss = (v: string | undefined, ph: string) => (v && v.trim() ? v : <span style={{ background: '#fff3c4' }}>{ph}</span>);
  return (
    <section className="glass-card rounded-xl p-4" aria-label="Bản in mẫu">
      <p className="mb-3 flex items-baseline gap-2 text-[15px] font-medium">Bản in mẫu<span className="text-xs font-normal text-[rgb(var(--muted))]">đầu trang báo giá</span></p>
      <div className="relative rounded border border-black/10 bg-white p-4 text-[#111] shadow-[0_6px_24px_rgba(17,24,39,0.08)]" style={{ fontFamily: '"Times New Roman", serif' }}>
        <div className="flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {c.logo ? <img src={c.logo} alt="" className="h-9 w-16 shrink-0 object-contain" /> : <span className="grid h-8 w-16 shrink-0 place-items-center rounded-sm bg-[#13223b] font-sans text-[11px] font-semibold text-white">{(c.shortName || c.appName || 'LOGO').slice(0, 8)}</span>}
          <div className="min-w-0 text-[10.5px] leading-[14px]">
            <b className="block text-[11px] uppercase">{miss(c.legalName, '[Tên pháp lý]')}</b>
            <span className="block">Trụ sở: {miss(c.address, '[Địa chỉ]')}</span>
            <span className="block">MST {miss(c.taxCode, '[MST]')} · {miss(c.phone, '[Điện thoại]')}{c.website ? ` · ${c.website}` : ''}</span>
          </div>
        </div>
        <p className="mt-4 text-center text-[13px] font-bold">BẢNG BÁO GIÁ</p>
        <div className="mt-2 space-y-1.5" aria-hidden><div className="h-1.5 bg-[#eef0f4]" /><div className="h-1.5 w-4/5 bg-[#eef0f4]" /><div className="h-1.5 w-3/5 bg-[#eef0f4]" /></div>
        <p className="mt-3 text-[10px]">Tài khoản: {miss(c.bankAccount, '[Số tài khoản]')} tại {miss(c.bankName, '[Ngân hàng]')}</p>
        <div className="mt-3 flex justify-end text-center text-[10px]">
          <div className="relative w-40">
            <b>ĐẠI DIỆN BÊN BÁN</b>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {c.stamp ? <img src={c.stamp} alt="" className="mx-auto my-1 h-16 object-contain" /> : <span className="mx-auto my-1 grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-[#c8281e]/50 text-[9px] text-[#c8281e]">chưa có<br />ảnh mộc</span>}
            <span className="block">{miss(c.representative, '[Người đại diện]')}</span>
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-[rgb(var(--muted))]">Ô vàng là thông tin còn thiếu, sẽ in trống trên báo giá và hợp đồng</p>
    </section>
  );
}

/** v42: AI đọc giấy phép ĐKKD / danh thiếp / báo giá cũ, đề xuất từng trường; người dùng bấm Dùng mới điền (chưa lưu) */
export function CompanyAiFill({ current, onApply, title = 'Điền từ giấy phép ĐKKD' }: { current: CompanyInfo; onApply: (p: Partial<CompanyInfo>) => void; title?: string }) {
  const { notify } = useApp();
  const ai = useAi('extract');
  const [busy, setBusy] = useState('');
  const [hits, setHits] = useState<{ key: keyof CompanyInfo; label: string; value: string }[] | null>(null);
  const read = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (!ai.available) return notify('Chưa bật AI đọc tài liệu: cần khóa Claude hoặc OpenAI trên máy chủ, bật ở Cài đặt › AI & trợ lý', 'orange');
    let mediaType = file.type; let data = '';
    try {
      if (file.type === 'application/pdf') {
        if (ai.provider !== 'ANTHROPIC') return notify('Đọc PDF cần Claude. Với OpenAI, chụp ảnh trang giấy phép để tải lên', 'orange');
        if (file.size > 3 * 1024 * 1024) return notify('PDF tối đa 3 MB', 'red');
        data = await fileB64(file);
      } else if (file.type.startsWith('image/')) { const url = await shrinkImage(file, 2000); mediaType = 'image/jpeg'; data = url.split(',')[1] ?? ''; }
      else return notify('Chọn ảnh (JPG, PNG) hoặc PDF', 'red');
    } catch { return notify('Không đọc được file', 'red'); }
    setBusy(`${ai.label} đang đọc ${file.name}…`);
    const r = await ai.ask({ image: { mediaType, data }, maxTokens: 700, prompt: 'Tài liệu đính kèm là giấy phép đăng ký kinh doanh, danh thiếp hoặc báo giá cũ của chính doanh nghiệp này. CHỈ trả về một đối tượng JSON, không thêm chữ: {"legalName":"","taxCode":"","address":"","phone":"","email":"","website":"","representative":"","representativeTitle":"","bankAccount":"","bankName":""}. Chép đúng chữ trong tài liệu, trường không có thì để chuỗi rỗng, không tự suy đoán.' });
    setBusy('');
    if (!r.ok) return notify(`Chưa đọc được: ${r.error}`, 'red');
    const d = parseAiJson<Record<string, unknown>>(r.text) ?? {};
    const list = COMPANY_AI_FIELDS.map(([key, label]) => ({ key, label, value: String(d[key] ?? '').replace(/\s+/g, ' ').trim() })).filter((x) => x.value && x.value !== String(current[x.key] ?? '').trim());
    setHits(list);
    if (!list.length) notify('Không thấy thông tin khác với dữ liệu đang có', 'teal');
  };
  const use = (keys: (keyof CompanyInfo)[]) => { if (!hits) return; onApply(Object.fromEntries(hits.filter((h) => keys.includes(h.key)).map((h) => [h.key, h.key === 'taxCode' ? h.value.replace(/\D/g, '') : h.value]))); setHits(hits.filter((h) => !keys.includes(h.key))); };
  return (
    <section className="glass-card rounded-xl p-4" aria-label={title}>
      <p className="mb-2 flex items-center gap-2 text-[14px] font-medium"><Sparkles className="h-4 w-4 text-[rgb(var(--fg2))]" aria-hidden />{title}<span className="ml-auto text-xs font-normal text-[rgb(var(--muted))]">{ai.available ? ai.label : 'chưa bật AI'}</span></p>
      <p className="mb-3 text-[13px] text-[rgb(var(--fg2))]">Tải giấy phép ĐKKD, danh thiếp hoặc báo giá cũ. AI đọc và đề xuất từng trường, bạn bấm Dùng rồi Lưu</p>
      <FilePicker accept="image/png,image/jpeg,image/webp,application/pdf" onFiles={(fs) => void read(fs)} disabled={!!busy} className="flex h-20 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[rgb(var(--line))] text-xs text-[rgb(var(--muted))]">
        {busy ? <><RefreshCw className="h-4 w-4 motion-safe:animate-spin" aria-hidden />{busy}</> : <><Upload className="h-4 w-4" aria-hidden />Kéo thả PDF / ảnh hoặc bấm để chọn</>}
      </FilePicker>
      {hits && hits.length > 0 && (
        <div className="mt-3">
          <ul className="divide-y divide-[rgb(var(--ink)/0.06)]">
            {hits.map((h) => (
              <li key={h.key} className="flex items-start gap-2 py-2 text-[13px]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--success))]" aria-hidden />
                <span className="min-w-0 flex-1"><span className="block text-xs text-[rgb(var(--muted))]">{h.label}{current[h.key] ? ' · khác dữ liệu đang lưu' : ''}</span><span className="block break-words">{h.value}</span></span>
                <button className={cn(btnGhost, btnSm)} onClick={() => use([h.key])}>Dùng</button>
              </li>
            ))}
          </ul>
          <button className={cn(btnGhost, btnSm, 'mt-1 w-full justify-center')} onClick={() => use(hits.map((h) => h.key))}>Dùng tất cả {hits.length} trường</button>
        </div>
      )}
    </section>
  );
}

// =====================================================================
//  v42: CÀI ĐẶT › TỔNG QUAN — danh sách thiết lập tính từ dữ liệu thật của doanh nghiệp
// =====================================================================
export function SettingsOverview({ go }: { go: (t: SettingsTab) => void }) {
  const { company, setCompany, departments, users, mfgConfig, warehouses, hubCfg, emailCfg, getfly, canDo, platform, org, notify } = useApp();
  const [srv] = useServerStatus();
  const mode = bizMode(company);
  const feat = platform.tenants.find((t) => t.id === org.id)?.features;
  const active = users.filter((u) => u.active);
  const weak = active.filter((u) => u.mustChangePassword).length;
  type Item = { g: string; t: string; d: string; ok: boolean; to: SettingsTab; opt?: boolean };
  const items: Item[] = [
    { g: 'Tổ chức', t: 'Thông tin doanh nghiệp', d: company.legalName && company.taxCode && company.address ? `${company.legalName} · MST ${company.taxCode}` : 'thiếu tên pháp lý, MST hoặc địa chỉ', ok: !!(company.legalName && company.taxCode && company.address), to: 'company' },
    { g: 'Tổ chức', t: 'Logo, mộc và chữ ký', d: company.logo && company.stamp ? 'đã có logo và ảnh mộc' : !company.stamp ? 'chưa có ảnh mộc, bản in để trống' : 'chưa có logo', ok: !!(company.logo && company.stamp), to: 'company' },
    { g: 'Tổ chức', t: 'Người đại diện và tài khoản ngân hàng', d: company.representative && company.bankAccount ? `${company.representative} · ${company.bankName || 'chưa ghi ngân hàng'}` : 'thiếu người đại diện hoặc số tài khoản trên báo giá', ok: !!(company.representative && company.bankAccount && company.bankName), to: 'company' },
    { g: 'Tổ chức', t: 'Phòng ban & nhân sự', d: `${departments.filter((d) => d.active).length} phòng · ${active.length} tài khoản hoạt động`, ok: departments.some((d) => d.active) && active.length > 1, to: 'org' },
    { g: 'Tổ chức', t: 'Phân quyền theo vai trò', d: weak ? `${weak} tài khoản còn mật khẩu tạm` : 'phân quyền theo vai trò, không có mật khẩu tạm', ok: weak === 0, to: 'perms' },
    { g: 'Nghiệp vụ', t: 'Kế toán & công nợ', d: `công nợ ${mfgConfig.creditDays} ngày · số dư đầu ${compact(mfgConfig.openingCash + mfgConfig.openingBank)}`, ok: mfgConfig.openingCash + mfgConfig.openingBank > 0, to: 'accounting' },
    ...(mode !== 'MFG' ? [{ g: 'Nghiệp vụ', t: 'Kho hàng', d: `${warehouses.filter((w) => w.active).length} kho đang hoạt động`, ok: warehouses.some((w) => w.active), to: 'warehouses' as SettingsTab }] : []),
    { g: 'Tích hợp', t: 'Trợ lý AI', d: !(srv.ai.anthropic || srv.ai.openai) ? 'máy chủ chưa có khóa Claude / OpenAI' : hubCfg.ai.enabled ? `đã bật · ${srv.ai.anthropic ? 'Claude' : 'OpenAI'}` : 'đã có khóa, đang tắt', ok: hubCfg.ai.enabled && (srv.ai.anthropic || srv.ai.openai), to: 'ai' },
    { g: 'Tích hợp', t: 'Zalo OA & ZNS', d: srv.zalo.oa ? `OA đã kết nối · ${hubCfg.zalo.znsTemplates.length} mẫu ZNS` : 'chưa có khóa Zalo OA trên máy chủ', ok: srv.zalo.oa, to: 'zalo', opt: true },
    ...(feat?.smtp !== false ? [{ g: 'Tích hợp', t: 'Email gửi báo giá, báo cáo', d: emailCfg.enabled ? `${emailCfg.host} · ${emailCfg.fromEmail}` : 'kênh email chưa bật', ok: emailCfg.enabled, to: 'email' as SettingsTab, opt: true }] : []),
    ...(mode !== 'MFG' && feat?.getfly !== false ? [{ g: 'Tích hợp', t: 'Getfly', d: getfly.isActive ? (getfly.demoMode ? 'đang chạy chế độ mô phỏng' : 'đã kết nối') : 'chưa kết nối · không bắt buộc', ok: getfly.isActive, to: 'getfly' as SettingsTab, opt: true }] : []),
  ];
  const done = items.filter((x) => x.ok).length;
  const groups = Array.from(new Set(items.map((x) => x.g)));
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px] xl:items-start">
      <section className="glass-card min-w-0 rounded-xl p-5">
        <div className="flex flex-wrap items-baseline gap-x-3"><h2 className="text-[15px] font-medium">Thiết lập {company.shortName || company.appName}</h2><span className="text-[13px] text-[rgb(var(--muted))]">{done} / {items.length} mục hoàn tất</span></div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--ink)/0.08)]"><div className="h-full rounded-full bg-[rgb(var(--fg)/0.75)]" style={{ width: `${(done / Math.max(1, items.length)) * 100}%` }} /></div>
        {groups.map((g) => (
          <div key={g} className="mt-4">
            <p className="pb-1 text-xs text-[rgb(var(--muted))]">{g}</p>
            <ul className="divide-y divide-[rgb(var(--ink)/0.06)]">
              {items.filter((x) => x.g === g).map((x) => (
                <li key={x.t} className="flex items-center gap-3 py-2.5 text-[13.5px]">
                  {x.ok ? <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[rgb(var(--success)/0.15)] text-[rgb(var(--success-fg))]"><CheckCircle2 className="h-3 w-3" aria-hidden /></span> : <span className="h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-dashed border-[rgb(var(--ink)/0.25)]" aria-hidden />}
                  <span className="min-w-0 flex-1"><span className="block font-medium">{x.t}{x.opt && !x.ok && <span className="ml-2 text-xs font-normal text-[rgb(var(--faint))]">không bắt buộc</span>}</span><span className="block truncate text-[12.5px] text-[rgb(var(--muted))]">{x.d}</span></span>
                  <button className={cn(btnGhost, btnSm, x.ok && 'border-0')} onClick={() => go(x.to)}>{x.ok ? 'Xem' : 'Thiết lập'}</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      <aside className="min-w-0 space-y-4 xl:sticky xl:top-20">
        {canDo('settings.edit') && <CompanyAiFill title="Thiết lập nhanh bằng AI" current={company} onApply={(p) => { setCompany({ ...company, ...p }); notify('Đã cập nhật thông tin doanh nghiệp', 'teal'); }} />}
        <section className="glass-card rounded-xl p-4 text-[13px]">
          <p className="mb-2 text-[14px] font-medium">Tài khoản</p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5">
            <dt className="text-[rgb(var(--muted))]">Đang hoạt động</dt><dd className="font-mono text-xs">{active.length}</dd>
            <dt className="text-[rgb(var(--muted))]">Mật khẩu tạm</dt><dd className="font-mono text-xs">{weak}</dd>
            <dt className="text-[rgb(var(--muted))]">Ngừng / khóa</dt><dd className="font-mono text-xs">{users.length - active.length}</dd>
          </dl>
        </section>
      </aside>
    </div>
  );
}

