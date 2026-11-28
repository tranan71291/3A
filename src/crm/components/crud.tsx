'use client';

import { type ReactNode, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { EmptyState, Field, Modal, MoneyInput, nodeText, Table } from './ui';
import { btnDanger, btnGhost, btnPrimary, btnSm, inputCls, rowCls, slug, tdCls, tdFirst, tdLast } from '../lib/core';
import type { ConfirmState, FieldSpec } from '../lib/types';
import { cn } from '../lib/utils';

// =====================================================================
//  THÀNH PHẦN DÙNG CHUNG: THU GỌN, XÁC NHẬN XÓA, BẢNG DANH MỤC CRUD
// =====================================================================

/** Khối thu gọn — mặc định đóng, bấm tiêu đề để mở chỉnh sửa */
export function Collapse({ title, summary, defaultOpen = true, action, children }: { title: string; summary?: ReactNode; defaultOpen?: boolean; action?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))]">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <button className="flex min-w-0 flex-1 items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))]" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-[rgb(var(--accent))]" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />}
          <span className="text-[15px] font-semibold text-[rgb(var(--fg))]">{title}</span>
          {summary && <span className="truncate text-xs text-[rgb(var(--muted))]">{summary}</span>}
        </button>
        {open && action}
      </div>
      {open && <div className="border-t border-[rgb(var(--line))] px-5 pb-5 pt-4">{children}</div>}
    </section>
  );
}

export function ConfirmDialog({ title, message, blocked, confirmLabel = 'Xóa', onConfirm, onClose }: ConfirmState & { onClose: () => void }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className={btnGhost} onClick={onClose}>{blocked ? 'Đóng' : 'Hủy'}</button>
          {!blocked && <button className={btnDanger} onClick={() => { onConfirm(); onClose(); }}><Trash2 className="h-4 w-4" aria-hidden />{confirmLabel}</button>}
        </>
      }
    >
      <div className="text-sm text-[rgb(var(--fg))]">{message}</div>
      {blocked && <p className="mt-3 flex items-start gap-2 rounded bg-[rgb(var(--danger)/0.1)] p-3 text-sm text-[rgb(var(--danger-fg))]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{blocked}</p>}
    </Modal>
  );
}

/** Mã viết hoa không dấu, không trùng — dùng cho danh mục tạo mới */
export function codeFrom(name: string, existing: string[]): string {
  const base = slug(name).toUpperCase().slice(0, 24) || 'MUC';
  let code = base;
  for (let i = 2; existing.includes(code); i++) code = `${base}_${i}`;
  return code;
}

export function EntityModal({ title, initial, fields, validate, onSave, onClose }: {
  title: string;
  initial: Record<string, unknown>;
  fields: FieldSpec[];
  validate: (v: Record<string, unknown>) => Record<string, string>;
  onSave: (v: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState<Record<string, unknown>>(initial);
  const [touched, setTouched] = useState(false);
  const errors = validate(v);
  const set = (k: string, val: unknown) => setV((p) => ({ ...p, [k]: val }));
  const save = () => {
    setTouched(true);
    if (Object.keys(errors).length) return;
    onSave(v);
    onClose();
  };
  return (
    <Modal title={title} onClose={onClose} footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}>Lưu</button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => {
          const err = touched ? errors[f.key] : undefined;
          const val = v[f.key];
          if (f.type === 'checkbox') {
            // v61: ô tích cũng hiện lỗi kiểm tra (vd. không ngừng dùng nguồn đơn mặc định)
            return (
              <div key={f.key} className={cn(f.wide && 'sm:col-span-2')}>
                <label className="flex items-center gap-2 text-sm text-[rgb(var(--fg))]">
                  <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={!!val} onChange={(e) => set(f.key, e.target.checked)} />{f.label}
                </label>
                {err && <p className="mt-1 text-xs text-[rgb(var(--danger-fg))]">{err}</p>}
              </div>
            );
          }
          if (f.type === 'multi') {
            const arr = (val as string[]) ?? [];
            return (
              <fieldset key={f.key} className="sm:col-span-2">
                <legend className="mb-1.5 text-xs font-medium text-[rgb(var(--muted))]">{f.label}</legend>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {f.options?.map((o) => (
                    <label key={o.value} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={arr.includes(o.value)} onChange={() => set(f.key, arr.includes(o.value) ? arr.filter((x) => x !== o.value) : [...arr, o.value])} />{o.label}
                    </label>
                  ))}
                </div>
                {err && <p className="mt-1 text-xs text-[rgb(var(--danger-fg))]">{err}</p>}
              </fieldset>
            );
          }
          return (
            <Field key={f.key} label={f.label} error={err} hint={f.hint} className={f.wide ? 'sm:col-span-2' : undefined}>
              {f.type === 'select' ? (
                <select className={inputCls} value={String(val ?? '')} onChange={(e) => set(f.key, e.target.value)}>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'money' ? (
                <MoneyInput value={Number(val ?? 0)} onChange={(n) => set(f.key, n)} />
              ) : f.type === 'number' ? (
                <input className={inputCls} type="number" value={Number(val ?? 0)} onChange={(e) => set(f.key, Number(e.target.value))} />
              ) : f.type === 'color' ? (
                <input className="h-10 w-full cursor-pointer rounded border border-[rgb(var(--line))] bg-[rgb(var(--bg))] p-1" type="color" value={String(val ?? '#F28C33')} onChange={(e) => set(f.key, e.target.value)} />
              ) : (
                <input className={inputCls} value={String(val ?? '')} onChange={(e) => set(f.key, e.target.value)} />
              )}
            </Field>
          );
        })}
      </div>
    </Modal>
  );
}

/** Bảng danh mục có Thêm / Sửa / Xóa dùng chung cho các cấu hình */
export function CatalogTable<T>({ rows, rowKey, columns, fields, entity, canEdit, blank, toForm, fromForm, validate, onSave, onDelete, deleteBlocked }: {
  rows: T[];
  rowKey: (r: T) => string;
  columns: { label: string; render: (r: T) => ReactNode }[];
  fields: FieldSpec[];
  entity: string;
  canEdit: boolean;
  blank: () => Record<string, unknown>;
  toForm: (r: T) => Record<string, unknown>;
  fromForm: (v: Record<string, unknown>, prev?: T) => T;
  validate: (v: Record<string, unknown>, prev?: T) => Record<string, string>;
  onSave: (row: T, prev?: T) => void;
  onDelete: (r: T) => void;
  deleteBlocked?: (r: T) => string | undefined;
}) {
  const [editing, setEditing] = useState<{ row?: T } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  return (
    <>
      {/* v61: danh mục cấu hình không cần ô chọn nhiều dòng (không có thao tác hàng loạt) */}
      <Table head={[...columns.map((c) => c.label), '']} minW={640} select={false}>
        {rows.map((r) => (
          <tr key={rowKey(r)} className={rowCls}>
            {columns.map((c, i) => <td key={c.label} className={i === 0 ? tdFirst : tdCls}>{c.render(r)}</td>)}
            <td className={cn(tdLast, 'whitespace-nowrap text-right')}>
              <button className={cn(btnGhost, 'mr-1 p-1.5')} disabled={!canEdit} onClick={() => setEditing({ row: r })} aria-label={`Sửa ${entity}`}><Pencil className="h-3.5 w-3.5" /></button>
              <button
                className={cn(btnGhost, 'p-1.5 hover:border-[rgb(var(--danger)/0.5)] hover:text-[rgb(var(--danger-fg))]')}
                disabled={!canEdit}
                onClick={() => setConfirm({ title: `Xóa ${entity}`, message: <>Xóa <b>{nodeText(columns[0].render(r))}</b>? Thao tác không hoàn tác được.</>, blocked: deleteBlocked?.(r), onConfirm: () => onDelete(r) })}
                aria-label={`Xóa ${entity}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </td>
          </tr>
        ))}
      </Table>
      {!rows.length && <EmptyState text={<>Chưa có {entity}.</>} art="box" compact />}
      <button className={cn(btnGhost, btnSm, 'mt-3')} disabled={!canEdit} onClick={() => setEditing({})}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm {entity}</button>
      {editing && (
        <EntityModal
          title={editing.row ? `Sửa ${entity}` : `Thêm ${entity}`}
          initial={editing.row ? toForm(editing.row) : blank()}
          fields={fields}
          validate={(v) => validate(v, editing.row)}
          onSave={(v) => onSave(fromForm(v, editing.row), editing.row)}
          onClose={() => setEditing(null)}
        />
      )}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </>
  );
}

