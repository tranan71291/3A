'use client';

import { removeWithUndo } from '../../app/context';
import { CatalogTable, codeFrom } from '../../components/crud';
import { Chip, Modal } from '../../components/ui';
import { btnPrimary, useApp } from '../../lib/core';
import type { CustomerSource } from '../../lib/types';

// =====================================================================
//  KHÁCH HÀNG: QUẢN LÝ NGUỒN KHÁCH
// =====================================================================

export function SourceManagerModal({ onClose }: { onClose: () => void }) {
  const { sources, setSources, customers, canDo, notify } = useApp();
  return (
    <Modal title="Nguồn khách hàng" onClose={onClose} wide footer={<button className={btnPrimary} onClick={onClose}>Xong</button>}>
      <p className="mb-3 text-sm text-[rgb(var(--muted))]">Nguồn có đánh dấu Marketing được tính vào doanh số và ROI Marketing.</p>
      <CatalogTable<CustomerSource>
        rows={sources}
        rowKey={(r) => r.id}
        entity="nguồn khách"
        canEdit={canDo('customer.edit')}
        columns={[
          { label: 'Tên nguồn', render: (r) => r.name },
          { label: 'Tính cho Marketing', render: (r) => (r.isMarketing ? <Chip tone="orange">Marketing</Chip> : <Chip>Không</Chip>) },
          { label: 'Số khách', render: (r) => customers.filter((c) => c.sourceId === r.id).length },
        ]}
        fields={[{ key: 'name', label: 'Tên nguồn', type: 'text', wide: true }, { key: 'isMarketing', label: 'Nguồn do Marketing tạo ra', type: 'checkbox', wide: true }]}
        blank={() => ({ name: '', isMarketing: false })}
        toForm={(r) => ({ ...r })}
        fromForm={(v, prev) => ({ id: prev?.id ?? codeFrom(String(v.name), sources.map((s) => s.id)), name: String(v.name).trim(), isMarketing: !!v.isMarketing })}
        validate={(v, prev): Record<string, string> => (String(v.name ?? '').trim().length < 3 ? { name: 'Tối thiểu 3 ký tự' } : sources.some((s) => s.id !== prev?.id && s.name.toLowerCase() === String(v.name).trim().toLowerCase()) ? { name: 'Tên nguồn đã có' } : {})}
        onSave={(row, prev) => { setSources((p) => (prev ? p.map((s) => (s.id === prev.id ? row : s)) : [...p, row])); notify(prev ? 'Đã sửa nguồn khách' : 'Đã thêm nguồn khách', 'teal'); }}
        onDelete={(r) => removeWithUndo(setSources, r, notify, `Đã xóa nguồn ${r.name}`)}
        deleteBlocked={(r) => { const n = customers.filter((c) => c.sourceId === r.id).length; return n ? `Đang có ${n} khách hàng thuộc nguồn này. Chuyển các khách hàng sang nguồn khác trước khi xóa.` : sources.length <= 1 ? 'Cần giữ ít nhất một nguồn.' : undefined; }}
      />
    </Modal>
  );
}

