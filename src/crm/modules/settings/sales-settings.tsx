'use client';

import { useState } from 'react';
import { CheckCircle2, Pencil } from 'lucide-react';
import { CatalogTable } from '../../components/crud';
import { Chip, Field, SetBlock } from '../../components/ui';
import { btnGhost, btnPrimary, btnSm, fold, inputCls, saleDefaultsOf, saleOriginsOf, uid, useApp } from '../../lib/core';
import type { SaleDefaults, SaleDelivery, SaleOrigin } from '../../lib/types';
import { cn } from '../../lib/utils';

// =====================================================================
//  v61 CÀI ĐẶT › BÁN HÀNG
//  1. Mặc định khi lên đơn: nguồn đơn, kho xuất, giao hàng, thanh toán, ô Xuất hóa đơn thuế (điền sẵn, sửa được trên từng đơn).
//     Số ngày công nợ dùng chung với Kế toán & công nợ (không khai báo 2 nơi).
//  2. Danh mục nguồn đơn hàng: form tạo đơn chọn trong danh mục; nút + trên form thêm nhanh (ghi vào cùng danh mục).
//     Ngừng dùng = ẩn khỏi form, đơn cũ giữ nguyên tên nguồn. Nguồn đã có đơn / nguồn mặc định không xóa được.
//  Chỉ người có quyền Cài đặt (Giám đốc) sửa được; mọi thay đổi ghi nhật ký.
// =====================================================================

const DLV: Record<SaleDelivery, string> = { PICKUP: 'Tại kho', DELIVER: 'Giao tận nơi', CARRIER: 'Chành xe' };
const PAY: Record<NonNullable<SaleDefaults['pay']>, string> = { CASH: 'Tiền mặt', BANK: 'Chuyển khoản', CREDIT: 'Công nợ' };

export function SaleSettings() {
  const { mfgConfig, setMfgConfig, salesOrders, warehouses, canDo, notify, audit, go } = useApp();
  const can = canDo('settings.edit');
  const rows = saleOriginsOf(mfgConfig);
  const saved = mfgConfig.saleDefaults ?? {};
  const [d, setD] = useState<SaleDefaults>(saved);
  const eff = saleDefaultsOf({ ...mfgConfig, saleDefaults: d }, warehouses);
  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  const actOrigins = rows.filter((r) => r.active);
  const originId = actOrigins.find((r) => r.name === eff.origin)?.id ?? '';
  const whs = warehouses.filter((w) => w.active);
  const used = (r: SaleOrigin) => salesOrders.filter((o) => fold(o.origin ?? '') === fold(r.name)).length;
  const put = (next: SaleOrigin[], what: string) => { setMfgConfig((c) => ({ ...c, saleOrigins: next })); audit('SALE_SETTINGS', what); };
  const save = () => {
    setMfgConfig((c) => ({ ...c, saleDefaults: d }));
    audit('SALE_SETTINGS', `Mặc định khi lên đơn: nguồn ${eff.origin}, kho ${warehouses.find((w) => w.id === eff.whId)?.name ?? '—'}, ${DLV[eff.delivery]}, ${PAY[eff.pay]}, hóa đơn ${eff.invoice ? 'tích sẵn' : eff.invoiceTax ? 'theo MST của khách' : 'không tích sẵn'}`);
    notify('Đã lưu mặc định khi lên đơn', 'teal');
  };
  const sel = cn(inputCls, 'w-full');
  return (
    <div className="space-y-5" data-sale-settings>
      <SetBlock
        title="Mặc định khi lên đơn"
        sub="Điền sẵn trên form tạo đơn, người lên đơn vẫn đổi được cho từng đơn"
        action={<>
          {dirty && <button className={cn(btnGhost, btnSm)} onClick={() => setD(saved)}>Hủy</button>}
          <button className={cn(btnPrimary, btnSm)} disabled={!can || !dirty} onClick={save} data-sale-defaults-save><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />Lưu</button>
        </>}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" data-sale-defaults>
          <Field label="Nguồn đơn hàng">
            <select className={sel} value={originId} disabled={!can || !actOrigins.length} onChange={(e) => setD({ ...d, origin: e.target.value })} aria-label="Nguồn đơn mặc định">
              {actOrigins.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <Field label="Kho xuất">
            <select className={sel} value={eff.whId} disabled={!can || whs.length < 2} onChange={(e) => setD({ ...d, whId: e.target.value })} aria-label="Kho xuất mặc định">
              {whs.map((w) => <option key={w.id} value={w.id}>{w.name}{w.main ? ' (kho tổng)' : ''}</option>)}
            </select>
          </Field>
          <Field label="Giao hàng">
            <select className={sel} value={eff.delivery} disabled={!can} onChange={(e) => setD({ ...d, delivery: e.target.value as SaleDelivery })} aria-label="Giao hàng mặc định">
              {(Object.keys(DLV) as SaleDelivery[]).map((k) => <option key={k} value={k}>{DLV[k]}</option>)}
            </select>
          </Field>
          <Field label="Phương thức thanh toán">
            <select className={sel} value={eff.pay} disabled={!can} onChange={(e) => setD({ ...d, pay: e.target.value as SaleDefaults['pay'] })} aria-label="Thanh toán mặc định">
              {(Object.keys(PAY) as NonNullable<SaleDefaults['pay']>[]).map((k) => <option key={k} value={k}>{PAY[k]}</option>)}
            </select>
          </Field>
          <Field label="Số ngày công nợ">
            <div className="flex gap-2">
              <span className={cn(inputCls, 'flex flex-1 items-center bg-[rgb(var(--ink)/0.03)] tabular-nums')} data-sale-credit-days>{eff.creditDays} ngày</span>
              <button type="button" className={cn(btnGhost, 'shrink-0')} onClick={() => go('settings', 'accounting')} title="Số ngày công nợ dùng chung với Kế toán & công nợ"><Pencil className="h-3.5 w-3.5" aria-hidden />Sửa</button>
            </div>
          </Field>
        </div>
        <div className="mt-5 space-y-2.5 border-t border-[rgb(var(--line))] pt-4 text-[13.5px]">
          <p className="text-[12.5px] text-[rgb(var(--muted))]">Ô Xuất hóa đơn thuế</p>
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 shrink-0 accent-[rgb(var(--accent))]" disabled={!can} checked={eff.invoiceTax} onChange={(e) => setD({ ...d, invoiceTax: e.target.checked })} />Tự tích khi chọn khách có mã số thuế</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 shrink-0 accent-[rgb(var(--accent))]" disabled={!can} checked={eff.invoice} onChange={(e) => setD({ ...d, invoice: e.target.checked })} />Tích sẵn cho mọi đơn mới, kể cả khách lẻ</label>
        </div>
      </SetBlock>

      <SetBlock flush title="Nguồn đơn hàng" sub={`${actOrigins.length} đang dùng · nút + trên form tạo đơn thêm nhanh vào danh mục này`}>
        <div data-sale-origins>
          <CatalogTable<SaleOrigin>
            rows={rows}
            rowKey={(r) => r.id}
            entity="nguồn đơn hàng"
            canEdit={can}
            columns={[
              { label: 'Tên nguồn', render: (r) => <span className="font-medium">{r.name}</span> },
              { label: 'Mặc định', render: (r) => (r.active && r.name === eff.origin ? <Chip tone="blue">Mặc định</Chip> : <span className="text-[rgb(var(--muted))]">—</span>) },
              { label: 'Số đơn', render: (r) => <span className="tabular-nums">{used(r)}</span> },
              { label: 'Trạng thái', render: (r) => (r.active ? <Chip tone="teal">Đang dùng</Chip> : <Chip>Ngừng dùng</Chip>) },
            ]}
            fields={[{ key: 'name', label: 'Tên nguồn', type: 'text', wide: true }, { key: 'active', label: 'Đang dùng (hiện trong form tạo đơn)', type: 'checkbox', wide: true }]}
            blank={() => ({ name: '', active: true })}
            toForm={(r) => ({ ...r })}
            fromForm={(v, prev) => ({ id: prev?.id ?? uid('src'), name: String(v.name).trim(), active: !!v.active })}
            validate={(v, prev): Record<string, string> => {
              const name = String(v.name ?? '').trim();
              if (name.length < 2) return { name: 'Tối thiểu 2 ký tự' };
              if (rows.some((s) => s.id !== prev?.id && fold(s.name) === fold(name))) return { name: 'Tên nguồn đã có' };
              if (prev && !v.active && prev.name === eff.origin) return { active: 'Đang là nguồn mặc định khi lên đơn: chọn nguồn mặc định khác trước' };
              if (prev?.active && !v.active && actOrigins.length <= 1) return { active: 'Cần giữ ít nhất một nguồn đang dùng' };
              return {};
            }}
            onSave={(row, prev) => {
              // đổi tên nguồn: đơn cũ giữ tên cũ (lịch sử), mặc định đi theo id nên vẫn đúng
              put(prev ? rows.map((s) => (s.id === prev.id ? row : s)) : [...rows, row], prev ? `Sửa nguồn đơn hàng ${prev.name}${prev.name !== row.name ? ` → ${row.name}` : ''}${prev.active !== row.active ? (row.active ? ', dùng lại' : ', ngừng dùng') : ''}` : `Thêm nguồn đơn hàng ${row.name}`);
              notify(prev ? 'Đã sửa nguồn đơn hàng' : 'Đã thêm nguồn đơn hàng', 'teal');
            }}
            onDelete={(r) => { put(rows.filter((s) => s.id !== r.id), `Xóa nguồn đơn hàng ${r.name}`); notify(`Đã xóa nguồn ${r.name}`, 'teal'); }}
            deleteBlocked={(r) => {
              const n = used(r);
              if (n) return `Đã có ${n} đơn thuộc nguồn này. Bỏ tích "Đang dùng" để ẩn khỏi form tạo đơn.`;
              if (r.active && r.name === eff.origin) return 'Đang là nguồn mặc định khi lên đơn. Chọn nguồn mặc định khác ở khối phía trên trước.';
              return rows.length <= 1 ? 'Cần giữ ít nhất một nguồn.' : undefined;
            }}
          />
        </div>
      </SetBlock>
    </div>
  );
}
