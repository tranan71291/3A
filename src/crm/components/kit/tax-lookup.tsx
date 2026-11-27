'use client';

import { useRef, useState } from 'react';
import { AlertTriangle, BadgeCheck, Building2, ExternalLink, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { btnGhost, btnSm, useApp } from '../../lib/core';
import { TAX_PORTAL_URL, taxErrText, taxKind, taxLookup, taxNorm, textSame } from '../../lib/taxcode';
import type { TaxInfo } from '../../lib/types';
import { cn } from '../../lib/utils';

// =====================================================================
//  v60 Tra cứu mã số thuế — dùng ở Tạo đơn hàng, Yêu cầu xuất hóa đơn, form khách hàng
//  Dữ liệu tra được chỉ là gợi ý: người dùng bấm "Dùng ..." mới ghi vào khách hàng / đơn.
// =====================================================================

export type TaxState = { busy: boolean; code?: string; info?: TaxInfo; err?: string };

/** Gọi tra cứu theo doanh nghiệp đang đăng nhập; bỏ kết quả của lần gọi cũ nếu người dùng gõ mã khác */
export function useTaxLookup() {
  const { org } = useApp();
  const [st, setSt] = useState<TaxState>({ busy: false });
  const seq = useRef(0);
  const run = async (code: string, force = false): Promise<TaxInfo | undefined> => {
    const v = taxNorm(code);
    const n = ++seq.current;
    if (!taxKind(v)) { setSt({ busy: false, code: v, err: 'format' }); return undefined; }
    setSt({ busy: true, code: v });
    const r = await taxLookup(org.id, v, force);
    if (n !== seq.current) return undefined;
    setSt(r.ok ? { busy: false, code: v, info: r.info } : { busy: false, code: v, err: r.error });
    return r.ok ? r.info : undefined;
  };
  const reset = () => { seq.current++; setSt({ busy: false }); };
  return { ...st, run, reset };
}

export const taxTime = (at: number) => new Date(at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

export function TaxPortalLink({ className }: { className?: string }) {
  return <a href={TAX_PORTAL_URL} target="_blank" rel="noreferrer noopener" className={cn('inline-flex items-center gap-1 whitespace-nowrap font-medium text-[rgb(var(--secondary-fg))] hover:underline', className)}><ExternalLink className="h-3.5 w-3.5" aria-hidden />Trang Cục Thuế</a>;
}

/**
 * Dải kết quả tra cứu dưới ô mã số thuế:
 *  - xanh: tra được, tên khớp; vàng: tên / địa chỉ khác dữ liệu đăng ký thuế (kèm nút dùng giá trị thuế); xám: lỗi / chưa tra được
 */
export function TaxStrip({ st, name, address, onRefresh, onUseName, onUseAddress, compact }: {
  st: TaxState; name?: string; address?: string; onRefresh?: () => void;
  onUseName?: (v: string) => void; onUseAddress?: (v: string) => void; compact?: boolean;
}) {
  if (st.busy) return <p className="mt-2 flex items-center gap-2 text-[13px] text-[rgb(var(--muted))]" role="status" data-tax-strip="busy"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Đang tra cứu mã số thuế…</p>;
  if (st.err) return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-[rgb(var(--ink)/0.04)] px-3 py-2 text-[13px] text-[rgb(var(--fg2))]" role="status" data-tax-strip="err">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /><span className="min-w-0 flex-1">{taxErrText(st.err)}</span><TaxPortalLink />
    </p>
  );
  const i = st.info;
  if (!i) return null;
  const nameOk = !name || textSame(name, i.name);
  const addrOk = !address || !i.address || textSame(address, i.address);
  // ô đang trống: hiện giá trị theo dữ liệu thuế để điền nhanh (tông thường, không phải cảnh báo lệch)
  const nameFill = !name?.trim() && !!onUseName;
  const addrFill = !address?.trim() && !!onUseAddress && !!i.address;
  const fillCls = 'flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-[rgb(var(--secondary)/0.06)] px-3 py-2 text-[13px] text-[rgb(var(--fg))]';
  return (
    <div className="mt-2 space-y-2" data-tax-strip={nameOk && addrOk ? 'ok' : 'diff'}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-[rgb(var(--success)/0.08)] px-3 py-2 text-[13px] text-[rgb(var(--success-fg))]" role="status">
        <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1"><b className="font-semibold">{i.status || 'Có trong dữ liệu đăng ký thuế'}</b>{name ? ` · tên ${nameOk ? 'khớp' : 'khác'} dữ liệu thuế` : ''} · tra lúc {taxTime(i.at)}</span>
        {onRefresh && <button type="button" className="inline-flex items-center gap-1 font-medium text-[rgb(var(--secondary-fg))] hover:underline" onClick={onRefresh}><RefreshCw className="h-3.5 w-3.5" aria-hidden />Tra lại</button>}
        {!compact && <TaxPortalLink />}
      </p>
      {!nameOk && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-[rgb(var(--accent)/0.09)] px-3 py-2 text-[13px] text-[rgb(var(--accent-fg))]">
          <Building2 className="h-4 w-4 shrink-0" aria-hidden /><span className="min-w-0 flex-1"><b className="font-semibold">Tên theo dữ liệu thuế:</b> {i.name}</span>
          {onUseName && <button type="button" className={cn(btnGhost, btnSm)} onClick={() => onUseName(i.name)}>Dùng tên này</button>}
        </div>
      )}
      {nameFill && (
        <div className={fillCls} data-tax-fill="name">
          <Building2 className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden /><span className="min-w-0 flex-1"><b className="font-semibold">Tên theo dữ liệu thuế:</b> {i.name}</span>
          <button type="button" className={cn(btnGhost, btnSm)} onClick={() => onUseName!(i.name)}>Dùng tên này</button>
        </div>
      )}
      {addrFill && (
        <div className={fillCls} data-tax-fill="address">
          <MapPin className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden /><span className="min-w-0 flex-1"><b className="font-semibold">Địa chỉ đăng ký thuế:</b> {i.address}</span>
          <button type="button" className={cn(btnGhost, btnSm)} onClick={() => onUseAddress!(i.address!)}>Dùng địa chỉ thuế</button>
        </div>
      )}
      {!addrOk && i.address && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-[rgb(var(--accent)/0.09)] px-3 py-2 text-[13px] text-[rgb(var(--accent-fg))]" data-tax-addr>
          <MapPin className="h-4 w-4 shrink-0" aria-hidden /><span className="min-w-0 flex-1"><b className="font-semibold">Địa chỉ đăng ký thuế khác địa chỉ đang lưu:</b> {i.address}</span>
          {onUseAddress && <button type="button" className={cn(btnGhost, btnSm)} onClick={() => onUseAddress(i.address!)}>Dùng địa chỉ thuế</button>}
        </div>
      )}
    </div>
  );
}

/** Thẻ kết quả trong ô tìm khách hàng (mã số thuế chưa có trong danh bạ) */
export function TaxResultCard({ info }: { info: TaxInfo }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--secondary)/0.2)] bg-[rgb(var(--secondary)/0.05)] px-3 py-2.5" data-tax-card>
      <div className="flex items-center gap-2"><Building2 className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden /><b className="min-w-0 flex-1 truncate text-[14px] font-semibold">{info.name}</b>{info.status && <span className="shrink-0 rounded-md bg-[rgb(var(--success)/0.12)] px-2 py-0.5 text-[12px] font-medium text-[rgb(var(--success-fg))]">{info.status}</span>}</div>
      <dl className="mt-1.5 grid grid-cols-[96px_1fr] gap-x-3 gap-y-1 pl-6 text-[13px]">
        <dt className="text-[rgb(var(--muted))]">Mã số thuế</dt><dd className="font-mono text-[12.5px]">{info.taxCode}</dd>
        {info.address && <><dt className="text-[rgb(var(--muted))]">Địa chỉ</dt><dd className="min-w-0">{info.address}</dd></>}
        {info.shortName && <><dt className="text-[rgb(var(--muted))]">Tên viết tắt</dt><dd className="min-w-0 truncate">{info.shortName}</dd></>}
      </dl>
    </div>
  );
}
