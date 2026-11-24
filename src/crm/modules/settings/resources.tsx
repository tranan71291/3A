'use client';

// v56 Cài đặt > Tài nguyên: doanh nghiệp tự quản lý đội thợ, xe, phòng chụp… dùng cho trường "Chọn tài nguyên" (chống trùng lịch).
// Loại tài nguyên lấy theo hồ sơ ngành của doanh nghiệp; tài nguyên đã có lịch không xóa, chỉ ngừng dùng (giữ dữ liệu cũ).
import { useMemo, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { Chip, Code, EmptyState, Field, Modal, SetBlock, Table } from '../../components/ui';
import { btnGhost, btnPrimary, btnSm, inputCls, rowCls, tdCls, tdFirst, tdLast, uid, useApp } from '../../lib/core';
import { rangeParse, rangeText, useTerminology } from '../../lib/industry';
import type { Resource } from '../../lib/types';
import { cn } from '../../lib/utils';
import { useSaleCf } from '../page-builder';

export function ResourceSettings() {
  const { resources, setResources, salesOrders, canDo, notify, audit, me } = useApp();
  const { profile, t } = useTerminology();
  const can = canDo('settings.edit');
  const kinds = profile?.resourceKinds ?? [];
  const kindLabel = (k: string) => kinds.find((x) => x.id === k)?.label ?? k;
  const [edit, setEdit] = useState<Resource | null>(null);
  const [kind, setKind] = useState<string>('ALL');
  const cf = useSaleCf();
  // Lịch sắp tới của từng tài nguyên: các đơn có trường chọn tài nguyên trỏ tới tài nguyên, khoảng thời gian chưa kết thúc
  const now = new Date().toISOString().slice(0, 16);
  const pick = cf.head.filter((d) => d.type === 'resource_picker' && d.rangeKey);
  const upcoming = useMemo(() => {
    const m = new Map<string, { code: string; text: string; from: string }[]>();
    for (const o of salesOrders) {
      if (o.status === 'CANCELLED') continue;
      for (const d of pick) {
        const id = o.cf?.[d.key];
        const r = rangeParse(o.cf?.[d.rangeKey!]);
        if (typeof id !== 'string' || !r || r.to < now) continue;
        m.set(id, [...(m.get(id) ?? []), { code: o.code, text: rangeText(r), from: r.from }].sort((a, b) => a.from.localeCompare(b.from)));
      }
    }
    return m;
  }, [salesOrders, pick, now]);
  const list = resources.filter((r) => kind === 'ALL' || r.kind === kind).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'vi'));
  const f = edit;
  const err: Record<string, string> = {};
  if (f) {
    if (f.name.trim().length < 2) err.name = 'Nhập tên';
    if (!f.kind) err.kind = 'Chọn loại';
    if (f.code?.trim() && resources.some((r) => r.code?.trim().toUpperCase() === f.code?.trim().toUpperCase() && r.id !== f.id)) err.code = 'Mã đã dùng';
  }
  const save = () => {
    if (!f || Object.keys(err).length) return;
    const clean: Resource = { ...f, name: f.name.trim(), code: f.code?.trim() || undefined, note: f.note?.trim() || undefined, at: Date.now(), by: me?.id };
    const isNew = !resources.some((r) => r.id === clean.id);
    setResources((all) => (isNew ? [...all, clean] : all.map((r) => (r.id === clean.id ? clean : r))));
    audit(isNew ? 'RESOURCE_CREATE' : 'RESOURCE_UPDATE', `${kindLabel(clean.kind)}: ${clean.name}${clean.active ? '' : ' (ngừng dùng)'}`);
    notify(isNew ? `Đã thêm ${clean.name}` : `Đã cập nhật ${clean.name}`, 'teal');
    setEdit(null);
  };
  const blank = (): Resource => ({ id: uid('rs'), kind: kind !== 'ALL' ? kind : kinds[0]?.id ?? '', name: '', active: true, at: Date.now() });
  return (
    <div className="space-y-4">
      <SetBlock title={`${t('resource')} & tài nguyên`} sub={`${resources.filter((r) => r.active).length} đang dùng · chọn ở trường "Chọn tài nguyên" trong ${t('sale').toLowerCase()}, hệ thống chặn trùng lịch`}
        action={<button className={cn(btnGhost, btnSm)} disabled={!can || !kinds.length} onClick={() => setEdit(blank())}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm tài nguyên</button>} flush>
        {kinds.length > 1 && (
          <div className="flex gap-1 px-4 pb-3" role="radiogroup" aria-label="Loại tài nguyên">
            {[{ id: 'ALL', label: 'Tất cả' }, ...kinds].map((k) => <button key={k.id} role="radio" aria-checked={kind === k.id} className={cn('rounded-md px-2.5 py-1 text-[13px]', kind === k.id ? 'bg-[rgb(var(--fg))] text-[rgb(var(--surface))]' : 'text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.05)]')} onClick={() => setKind(k.id)}>{k.label}</button>)}
          </div>
        )}
        {list.length ? (
          <Table head={['Tên', 'Mã', 'Loại', 'Ghi chú', 'Lịch sắp tới', 'Trạng thái', '']} minW={860}>
            {list.map((r) => { const up = upcoming.get(r.id) ?? []; return (
              <tr key={r.id} className={rowCls}>
                <td className={tdFirst}><span className="font-medium">{r.name}</span></td>
                <td className={tdCls}>{r.code ? <Code>{r.code}</Code> : '—'}</td>
                <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{kindLabel(r.kind)}</td>
                <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}><span className="block max-w-[220px] truncate" title={r.note}>{r.note || '—'}</span></td>
                <td className={cn(tdCls, 'tabular-nums')}><span className="block max-w-[260px] truncate" title={up.map((x) => `${x.code}: ${x.text}`).join('\n')}>{up.length ? `${up[0].text}${up.length > 1 ? ` (+${up.length - 1})` : ''}` : '—'}</span></td>
                <td className={tdCls}><Chip tone={r.active ? 'teal' : 'muted'}>{r.active ? 'Đang dùng' : 'Ngừng dùng'}</Chip></td>
                <td className={cn(tdLast, 'text-right')}><button className={cn(btnGhost, 'p-1.5')} disabled={!can} onClick={() => setEdit({ ...r })} aria-label={`Sửa ${r.name}`}><Pencil className="h-3.5 w-3.5" aria-hidden /></button></td>
              </tr>
            ); })}
          </Table>
        ) : <EmptyState text={kinds.length ? 'Chưa có tài nguyên' : 'Ngành của doanh nghiệp chưa có loại tài nguyên (3A khai báo trong hồ sơ ngành)'} art="box" action={can && kinds.length ? 'Thêm tài nguyên' : undefined} onAction={() => setEdit(blank())} />}
      </SetBlock>
      {f && (
        <Modal title={resources.some((r) => r.id === f.id) ? `Sửa ${f.name}` : 'Thêm tài nguyên'} onClose={() => setEdit(null)}
          footer={<><button className={btnGhost} onClick={() => setEdit(null)}>Hủy</button><button className={btnPrimary} disabled={Object.keys(err).length > 0} onClick={save}>Lưu</button></>}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tên *" error={err.name}><input className={inputCls} value={f.name} onChange={(e) => setEdit({ ...f, name: e.target.value })} placeholder="VD: Đội lắp đặt số 1" /></Field>
            <Field label="Loại *" error={err.kind}><select className={inputCls} value={f.kind} onChange={(e) => setEdit({ ...f, kind: e.target.value })}>{kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></Field>
            <Field label="Mã / biển số" error={err.code}><input className={inputCls} value={f.code ?? ''} onChange={(e) => setEdit({ ...f, code: e.target.value })} placeholder="VD: DOI-01, 51C-123.45" /></Field>
            <Field label="Trạng thái"><select className={inputCls} value={f.active ? '1' : '0'} onChange={(e) => setEdit({ ...f, active: e.target.value === '1' })}><option value="1">Đang dùng</option><option value="0">Ngừng dùng (giữ lịch cũ)</option></select></Field>
            <Field label="Ghi chú" className="sm:col-span-2"><input className={inputCls} value={f.note ?? ''} onChange={(e) => setEdit({ ...f, note: e.target.value })} placeholder="VD: 4 thợ, trưởng đội anh Tâm" /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
