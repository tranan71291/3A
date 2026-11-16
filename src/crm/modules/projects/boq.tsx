'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../components/ui';
import { btnGhost, btnPrimary, btnSm, compact, digits, inputBase, inputCls, useApp, vnd } from '../../lib/core';
import type { BoqItem, Lead } from '../../lib/types';
import { cn } from '../../lib/utils';

// =====================================================================
//  DỰ ÁN: BÓC TÁCH BOQ & BÁO GIÁ
// =====================================================================

export function BoqEditorModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { setLeads, notify, skus } = useApp();
  const [rows, setRows] = useState<BoqItem[]>(lead.boqItems?.length ? lead.boqItems : [{ code: '', name: '', unit: 'Bộ', qty: 1, price: 0, discountPct: 0 }]);
  const [touched, setTouched] = useState(false);
  const setRow = (i: number, p: Partial<BoqItem>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const lineTotal = (x: BoqItem) => x.qty * x.price * (1 - x.discountPct / 100);
  const total = rows.reduce((s, x) => s + lineTotal(x), 0);
  const invalid = rows.some((x) => !x.code.trim() || !x.name.trim() || x.qty <= 0 || x.price <= 0 || x.discountPct < 0 || x.discountPct > 100);

  const save = () => {
    setTouched(true);
    const clean = rows.filter((x) => x.code.trim() || x.name.trim());
    if (clean.some((x) => !x.code.trim() || !x.name.trim() || x.qty <= 0 || x.price <= 0)) return;
    setLeads((p) => p.map((l) => (l.id === lead.id ? { ...l, boqItems: clean, boqStatus: clean.length ? 'DONE' : l.boqStatus } : l)));
    notify(`Đã lưu ${clean.length} dòng BOQ, tổng ${compact(Math.round(clean.reduce((s, x) => s + lineTotal(x), 0)))}`, 'teal');
    onClose();
  };

  return (
    <Modal title={`Bóc tách BOQ: ${lead.company}`} onClose={onClose} wide footer={<><span className="mr-auto self-center text-sm tabular-nums">Tổng BOQ: <b>{vnd(total)}</b> (ước tính MKT {compact(lead.boqValue)})</span><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}>Lưu BOQ</button></>}>
      <p className="mb-3 text-xs text-[rgb(var(--muted))]">Mã sản phẩm nên trùng mã trên Getfly để đơn hàng đồng bộ đúng. Sau khi lưu, giá trị dự án lấy theo tổng BOQ thay cho số ước tính.</p>
      <div className="-mx-5 overflow-x-auto">
        <table className="dt w-full min-w-[760px] text-sm">
          <thead className="text-xs text-[rgb(var(--muted))]">
            <tr className="border-b border-[rgb(var(--line))] text-left">
              <th className="py-2 pl-5 pr-2 font-medium">Mã SP</th><th className="px-2 py-2 font-medium">Tên vật tư</th><th className="px-2 py-2 font-medium">ĐVT</th>
              <th className="px-2 py-2 font-medium">SL</th><th className="px-2 py-2 font-medium">Đơn giá</th><th className="px-2 py-2 font-medium">CK %</th>
              <th className="px-2 py-2 text-right font-medium">Thành tiền</th><th className="py-2 pl-2 pr-5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((x, i) => (
              <tr key={i} className="border-b border-[rgb(var(--line)/0.6)]">
                <td className="py-1.5 pl-5 pr-2"><input className={cn(inputBase, 'w-36 py-1 text-xs', touched && !x.code.trim() && 'border-[rgb(var(--danger))]')} list="boq-skus" value={x.code} onChange={(e) => { const code = e.target.value.toUpperCase(); const k = skus.find((s) => s.sku === code); setRow(i, k ? { code, name: x.name || k.name, unit: k.unit, price: x.price || k.projectPrice || k.basePrice } : { code }); }} aria-label="Mã sản phẩm" /></td>
                <td className="px-2 py-1.5"><input className={cn(inputCls, 'min-w-[200px] py-1 text-xs', touched && !x.name.trim() && 'border-[rgb(var(--danger))]')} value={x.name} onChange={(e) => setRow(i, { name: e.target.value })} aria-label="Tên vật tư" /></td>
                <td className="px-2 py-1.5"><input className={cn(inputBase, 'w-16 py-1 text-xs')} value={x.unit} onChange={(e) => setRow(i, { unit: e.target.value })} aria-label="Đơn vị tính" /></td>
                <td className="px-2 py-1.5"><input className={cn(inputBase, 'w-20 py-1 text-xs')} type="number" min={0} value={x.qty} onChange={(e) => setRow(i, { qty: Number(e.target.value) })} aria-label="Số lượng" /></td>
                <td className="px-2 py-1.5"><input className={cn(inputBase, 'w-32 py-1 text-xs tabular-nums')} inputMode="numeric" value={x.price ? new Intl.NumberFormat('vi-VN').format(x.price) : ''} onChange={(e) => setRow(i, { price: digits(e.target.value) })} aria-label="Đơn giá" /></td>
                <td className="px-2 py-1.5"><input className={cn(inputBase, 'w-16 py-1 text-xs')} type="number" min={0} max={100} value={x.discountPct} onChange={(e) => setRow(i, { discountPct: Number(e.target.value) })} aria-label="Chiết khấu" /></td>
                <td className="px-2 py-1.5 text-right tabular-nums">{vnd(lineTotal(x))}</td>
                <td className="py-1.5 pl-2 pr-5"><button className="text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} aria-label="Xóa dòng"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <datalist id="boq-skus">{skus.map((s) => <option key={s.sku} value={s.sku}>{s.name}</option>)}</datalist>
      <button className={cn(btnGhost, btnSm, 'mt-3')} onClick={() => setRows((r) => [...r, { code: '', name: '', unit: 'Bộ', qty: 1, price: 0, discountPct: 0 }])}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm dòng</button>
      {touched && invalid && <p className="mt-2 text-xs text-[rgb(var(--danger-fg))]">Mỗi dòng cần mã, tên, số lượng và đơn giá lớn hơn 0.</p>}
    </Modal>
  );
}

