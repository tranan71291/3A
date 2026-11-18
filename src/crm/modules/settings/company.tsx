'use client';

import { useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Field, FilePicker, Panel } from '../../components/ui';
import { btnGhost, btnPrimary, btnSm, EMAIL_RE, initials, inputCls, MST_RE, useApp } from '../../lib/core';
import type { CompanyInfo } from '../../lib/types';
import { cn } from '../../lib/utils';

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

  return (
    <Panel title="Thông tin doanh nghiệp">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
        <div>
          <p className="mb-2 text-xs font-medium text-[rgb(var(--muted))]">Logo</p>
          <FilePicker accept="image/png,image/jpeg,image/svg+xml,image/webp" onFiles={pickLogo} disabled={!canEdit} className="flex aspect-square w-full max-w-[200px] items-center justify-center overflow-hidden rounded-md border border-dashed border-[rgb(var(--line))] bg-[rgb(var(--bg))] hover:border-[rgb(var(--accent)/0.6)]">
            {f.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.logo} alt="Logo doanh nghiệp" className="h-full w-full bg-white object-contain p-3" />
            ) : (
              <span className="flex flex-col items-center gap-2 text-xs text-[rgb(var(--muted))]"><ImagePlus className="h-6 w-6" aria-hidden />Tải logo (tối đa 1 MB)</span>
            )}
          </FilePicker>
          {f.logo && <button className={cn(btnGhost, btnSm, 'mt-2')} disabled={!canEdit} onClick={() => set('logo', undefined)}><Trash2 className="h-3.5 w-3.5" aria-hidden />Gỡ logo</button>}
          <p className="mt-2 text-xs text-[rgb(var(--muted))]">Hiển thị ở thanh bên, màn hình đăng nhập và email báo cáo.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tên hệ thống" error={err('appName')}><input className={inputCls} disabled={!canEdit} value={f.appName} onChange={(ev) => set('appName', ev.target.value)} /></Field>
          <Field label="Tên viết tắt"><input className={inputCls} disabled={!canEdit} value={f.shortName} onChange={(ev) => set('shortName', ev.target.value)} /></Field>
          <Field label="Tên pháp lý" error={err('legalName')} className="sm:col-span-2"><input className={inputCls} disabled={!canEdit} value={f.legalName} onChange={(ev) => set('legalName', ev.target.value)} /></Field>
          <Field label="Mã số thuế" error={err('taxCode')}><input className={inputCls} disabled={!canEdit} value={f.taxCode} onChange={(ev) => set('taxCode', ev.target.value.trim())} /></Field>
          <Field label="Điện thoại"><input type="tel" autoComplete="tel" className={inputCls} disabled={!canEdit} inputMode="tel" value={f.phone} onChange={(ev) => set('phone', ev.target.value)} /></Field>
          <Field label="Địa chỉ" className="sm:col-span-2"><input className={inputCls} disabled={!canEdit} value={f.address} onChange={(ev) => set('address', ev.target.value)} /></Field>
          <Field label="Email" error={err('email')}><input type="email" autoComplete="email" spellCheck={false} className={inputCls} disabled={!canEdit} value={f.email} onChange={(ev) => set('email', ev.target.value.trim())} /></Field>
          <Field label="Website"><input className={inputCls} disabled={!canEdit} value={f.website} onChange={(ev) => set('website', ev.target.value.trim())} /></Field>
          <Field label="Người đại diện ký báo giá / hợp đồng"><input className={inputCls} disabled={!canEdit} value={f.representative} onChange={(ev) => set('representative', ev.target.value)} /></Field>
          <Field label="Chức vụ"><input className={inputCls} disabled={!canEdit} value={f.representativeTitle} onChange={(ev) => set('representativeTitle', ev.target.value)} /></Field>
          <Field label="Số tài khoản"><input className={inputCls} disabled={!canEdit} value={f.bankAccount} onChange={(ev) => set('bankAccount', ev.target.value)} /></Field>
          <Field label="Ngân hàng, chi nhánh"><input className={inputCls} disabled={!canEdit} value={f.bankName} onChange={(ev) => set('bankName', ev.target.value)} /></Field>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-xs font-medium text-[rgb(var(--muted))]">Ảnh mộc và chữ ký (chèn vào {'{{company_stamp}}'} trên báo giá / hợp đồng)</p>
            <div className="flex flex-wrap items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {f.stamp && <img src={f.stamp} alt="Mộc và chữ ký" className="h-20 rounded bg-white object-contain p-1" />}
              <FilePicker accept="image/png,image/jpeg,image/webp" disabled={!canEdit} onFiles={(files) => { const file = files[0]; if (!file.type.startsWith('image/') || file.size > 1024 * 1024) return notify('Chọn ảnh PNG / JPG tối đa 1 MB (nên dùng PNG nền trong suốt)', 'red'); const r = new FileReader(); r.onload = () => set('stamp', String(r.result)); r.readAsDataURL(file); }} className={cn(btnGhost, btnSm)}><ImagePlus className="h-3.5 w-3.5" aria-hidden />{f.stamp ? 'Đổi ảnh' : 'Tải ảnh mộc / chữ ký'}</FilePicker>
              {f.stamp && <button className={cn(btnGhost, btnSm)} disabled={!canEdit} onClick={() => set('stamp', undefined)}>Gỡ ảnh</button>}
            </div>
            <p className="mt-1 text-xs text-[rgb(var(--muted))]">Đây là ảnh mộc chèn vào bản in, không thay thế chữ ký số. Ký số cần chứng thư số và thực hiện phía máy chủ.</p>
          </div>
          <div className="sm:col-span-2"><button className={btnPrimary} disabled={!canEdit} onClick={save}>Lưu thông tin doanh nghiệp</button></div>
        </div>
      </div>
    </Panel>
  );
}

