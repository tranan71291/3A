'use client';

import { useState } from 'react';
import { Download, Eye, FolderOpen, HardDrive, Lock, Pencil, RefreshCw, Trash2, Upload } from 'lucide-react';
import { removeWithUndo } from '../../app/context';
import { Pagination, RowMenu, usePaged } from '../../components/controls';
import { ConfirmDialog } from '../../components/crud';
import { ChipFilter, FilterBar, useInRange } from '../../components/filters';
import { Chip, EmptyState, Field, FilePicker, Modal, Panel, StatCard, Table, useSort, useSticky } from '../../components/ui';
import { btnGhost, btnPrimary, btnSm, C, canViewDoc, DOC_CATEGORY, docVisibility, fmtDate, FORMAT_COLOR, inputCls, kpiGrid, ROLE_LABEL, rowCls, slug, tdCls, tdFirst, tdLast, todayISO, uid, useApp, visibilityOptions } from '../../lib/core';
import type { ConfirmState, Department, DocCategory, DocItem, DocVisibility } from '../../lib/types';
import { cn } from '../../lib/utils';

export function downloadDoc(d: DocItem, ownerName: string, departments: Department[]) {
  const a = document.createElement('a');
  if (d.url) {
    a.href = d.url;
    a.download = d.title;
  } else {
    const text = [
      d.title,
      `Danh mục: ${DOC_CATEGORY[d.category]}`,
      `Phạm vi xem: ${docVisibility(d.visibility, departments).label}`,
      `Phiên bản: ${d.version}, cập nhật ${fmtDate(d.updatedAt)}, phụ trách ${ownerName}`,
      '',
      'Tóm tắt:',
      d.summary,
      '',
      `Từ khóa: ${d.tags.join(', ')}`,
      '',
      '(Tệp mẫu từ bản demo VASSH-CRM. Bản thật lưu ở Supabase Storage, quyền tải theo phạm vi hiển thị.)',
    ].join('\r\n');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' }));
    a.download = `${slug(d.title)}_mau.txt`;
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  a.click();
}

export function DocUploadModal({ doc: existing, onClose }: { doc?: DocItem; onClose: () => void }) {
  const { setDocs, me, notify, departments } = useApp();
  const [title, setTitle] = useState(existing?.title ?? '');
  const [category, setCategory] = useState<DocCategory>(existing?.category ?? 'POLICY');
  const [visibility, setVisibility] = useState<DocVisibility>(existing?.visibility ?? 'ALL');
  const [summary, setSummary] = useState(existing?.summary ?? '');
  const [tags, setTags] = useState((existing?.tags ?? []).join(', '));
  const [file, setFile] = useState<File | null>(null);
  const [touched, setTouched] = useState(false);
  const e = { title: title.trim().length < 5 ? 'Tên tài liệu tối thiểu 5 ký tự' : '', file: !file && !existing ? 'Chọn file tài liệu' : '' };

  const save = () => {
    setTouched(true);
    if (e.title || e.file) return;
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (existing) {
      setDocs((p) => p.map((d) => (d.id === existing.id ? {
        ...d, title: title.trim(), category, visibility, summary: summary.trim() || d.summary, tags: tagList, updatedAt: todayISO(),
        ...(file ? { url: URL.createObjectURL(file), sizeKb: Math.max(1, Math.round(file.size / 1024)), version: `v${(parseFloat(d.version.replace(/[^\d.]/g, '')) || 1) + 0.1}`.replace(/(\.\d)\d+$/, '$1') } : {}),
      } : d)));
      notify(`Đã cập nhật "${title.trim()}"`, 'teal');
      onClose();
      return;
    }
    if (!file) return;
    const ext = file.name.split('.').pop()?.toUpperCase() ?? '';
    const format: DocItem['format'] = ext.startsWith('DOC') ? 'DOCX' : ext.startsWith('XLS') ? 'XLSX' : ext.startsWith('PPT') ? 'PPTX' : 'PDF';
    setDocs((p) => [{ id: uid('d'), title: title.trim(), category, visibility, ownerId: me.id, updatedAt: todayISO(), version: 'v1.0', format, sizeKb: Math.max(1, Math.round(file.size / 1024)), summary: summary.trim() || 'Chưa có tóm tắt.', tags: tagList, url: URL.createObjectURL(file) }, ...p]);
    notify(`Đã tải lên "${title.trim()}" với phạm vi ${docVisibility(visibility, departments).label}`, 'teal');
    onClose();
  };

  return (
    <Modal title={existing ? "Sửa tài liệu" : "Tải lên tài liệu"} onClose={onClose} footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}>Tải lên</button></>}>
      <div className="space-y-4">
        <FilePicker accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onFiles={(f) => { setFile(f[0]); if (!title) setTitle(f[0].name.replace(/\.[^.]+$/, '')); }} className="rounded-md border border-dashed border-[rgb(var(--line))] bg-[rgb(var(--bg))] px-4 py-6 text-center hover:border-[rgb(var(--accent)/0.6)]">
          <Upload className="mx-auto h-6 w-6 text-[rgb(var(--accent))]" aria-hidden />
          <p className="mt-2 text-sm">{file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : (existing ? 'Tải phiên bản mới (không bắt buộc)' : 'Chọn hoặc kéo thả file PDF, Word, Excel, PowerPoint')}</p>
        </FilePicker>
        {touched && e.file && <p className="text-xs text-[rgb(var(--danger-fg))]">{e.file}</p>}
        <Field label="Tên tài liệu *" error={touched ? e.title || undefined : undefined}><input className={inputCls} value={title} onChange={(ev) => setTitle(ev.target.value)} /></Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Danh mục">
            <select className={inputCls} value={category} onChange={(ev) => setCategory(ev.target.value as DocCategory)}>
              {(Object.keys(DOC_CATEGORY) as DocCategory[]).map((c) => <option key={c} value={c}>{DOC_CATEGORY[c]}</option>)}
            </select>
          </Field>
          <Field label="Phạm vi hiển thị">
            <select className={inputCls} value={visibility} onChange={(ev) => setVisibility(ev.target.value as DocVisibility)}>
              {visibilityOptions(departments).map((v) => <option key={v} value={v}>{docVisibility(v, departments).label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Từ khóa (cách nhau dấu phẩy)"><input className={inputCls} value={tags} onChange={(ev) => setTags(ev.target.value)} /></Field>
        <Field label="Tóm tắt nội dung"><textarea className={cn(inputCls, 'min-h-20')} value={summary} onChange={(ev) => setSummary(ev.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export function DocsPage() {
  const { docs, setDocs, me, canDo, userName, departments, notify } = useApp();
  const [editDoc, setEditDoc] = useState<DocItem | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const inR = useInRange();
  const [q, setQ] = useSticky('DocsPage.q', '');
  const [cat, setCat] = useState('ALL');
  const [vis, setVis] = useState<'ALL_VIS' | DocVisibility>('ALL_VIS');
  const [view, setView] = useSticky<DocItem | null>('DocsPage.view', null);
  const [uploading, setUploading] = useState(false);

  const visible = docs.filter((d) => canViewDoc(d, me));
  const hidden = docs.length - visible.length;
  const list = visible.filter((d) => {
    const t = q.trim().toLowerCase();
    return (!t || [d.title, d.summary, ...d.tags].some((v) => v.toLowerCase().includes(t))) && (cat === 'ALL' || d.category === cat) && (vis === 'ALL_VIS' || d.visibility === vis) && inR(d.updatedAt);
  });

  const srt = useSort('DocsPage', list, { 0: (d) => d.title, 1: (d) => d.category, 4: (d) => d.updatedAt, 5: (d) => d.sizeKb });
  const paged = usePaged(srt.rows, 12);
  const sizeOf = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);
  const recent = visible.filter((d) => inR(d.updatedAt)).length;
  return (
    <div className="space-y-4">
      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="Tài liệu được xem" value={String(visible.length)} icon={FolderOpen} color={C.orange} sub={`${Object.keys(DOC_CATEGORY).length} danh mục`} />
        <StatCard label="Cập nhật trong kỳ" value={String(recent)} icon={RefreshCw} color={C.teal} sub="Theo bộ lọc thời gian" />
        <StatCard label="Ẩn theo phạm vi" value={String(hidden)} icon={Lock} color={hidden ? C.red : C.teal} sub={`Vai trò ${ROLE_LABEL[me.role]}`} />
        <StatCard label="Dung lượng" value={sizeOf(visible.reduce((x, d) => x + d.sizeKb, 0))} icon={HardDrive} color={C.orange} sub="Tổng các tài liệu xem được" />
      </div>

      <FilterBar
        q={q} onQ={setQ} placeholder="Tìm tên tài liệu, nội dung, từ khóa"
        status={cat} onStatus={setCat} statusLabel="Danh mục" extraActive={vis !== 'ALL_VIS' ? 1 : 0}
        statusOptions={(Object.keys(DOC_CATEGORY) as DocCategory[]).map((c) => ({ value: c, label: DOC_CATEGORY[c] }))}
        actions={<button className={cn(btnPrimary, 'py-2')} disabled={!canDo('docs.manage')} onClick={() => setUploading(true)}><Upload className="h-4 w-4" aria-hidden />Tải lên tài liệu</button>}
        chips={<ChipFilter value={cat === 'ALL' ? 'ALL' : (cat as DocCategory)} onChange={(v) => setCat(v)} total={visible.length} options={(Object.keys(DOC_CATEGORY) as DocCategory[]).map((c) => ({ value: c, label: DOC_CATEGORY[c], count: visible.filter((d) => d.category === c).length }))} />}
      >
        <select className={cn(inputCls, 'w-full border-[rgb(var(--line))] bg-[rgb(var(--bg))] py-2 sm:w-auto')} value={vis} onChange={(e) => setVis(e.target.value as 'ALL_VIS' | DocVisibility)} aria-label="Phạm vi hiển thị">
          <option value="ALL_VIS">Phạm vi</option>
          {visibilityOptions(departments).map((v) => <option key={v} value={v}>{docVisibility(v, departments).label}</option>)}
        </select>
      </FilterBar>

      <Panel>
        <Table stt={Math.max(0, paged.from - 1)} minW={1000} sort={srt.th} head={['Tài liệu', 'Danh mục', 'Phạm vi', 'Người phụ trách', 'Phiên bản / cập nhật', <span key="s" className="block text-right">Dung lượng</span>, <span key="a" className="block text-right">Thao tác</span>]}>
          {paged.slice.map((d) => (
            <tr key={d.id} className={rowCls}>
              <td className={cn(tdFirst, 'max-w-[300px]')}>
                <button className="flex max-w-full items-start gap-3 text-left" onClick={() => setView(d)}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-[10px] font-bold" style={{ background: `${FORMAT_COLOR[d.format]}22`, color: FORMAT_COLOR[d.format] }}>{d.format}</span>
                  <span className="min-w-0"><span className="block truncate font-medium text-[rgb(var(--fg))] hover:text-[rgb(var(--accent-fg))]">{d.title}</span><span className="block truncate text-xs text-[rgb(var(--muted))]">{d.summary}</span></span>
                </button>
              </td>
              <td className={cn(tdCls, 'whitespace-nowrap text-xs')}>{DOC_CATEGORY[d.category]}</td>
              <td className={cn(tdCls, 'whitespace-nowrap')}><Chip tone={docVisibility(d.visibility, departments).tone}>{docVisibility(d.visibility, departments).label}</Chip></td>
              <td className={cn(tdCls, 'whitespace-nowrap text-xs')}>{userName(d.ownerId)}</td>
              <td className={cn(tdCls, 'whitespace-nowrap text-xs tabular-nums')}>{d.version}<span className="block text-[rgb(var(--muted))]">{fmtDate(d.updatedAt)}</span></td>
              <td className={cn(tdCls, 'whitespace-nowrap text-right text-xs tabular-nums')}>{sizeOf(d.sizeKb)}</td>
              <td className={tdLast}>
                <div className="flex items-center justify-end gap-1.5">
                  <button className={cn(btnGhost, btnSm)} onClick={() => setView(d)} aria-label={`Xem ${d.title}`}><Eye className="h-3.5 w-3.5" aria-hidden /></button>
                  <button className={cn(btnGhost, btnSm)} onClick={() => downloadDoc(d, userName(d.ownerId), departments)} aria-label={`Tải ${d.title}`}><Download className="h-3.5 w-3.5" aria-hidden /></button>
                  <RowMenu items={[
                    { label: 'Sửa / cập nhật phiên bản', icon: Pencil, onClick: () => setEditDoc(d), disabled: !canDo('docs.manage') },
                    { label: 'Xóa tài liệu', icon: Trash2, danger: true, disabled: !canDo('docs.manage'), onClick: () => setConfirm({ title: 'Xóa tài liệu', message: <>Xóa <b>{d.title}</b> khỏi kho tài liệu?</>, onConfirm: () => removeWithUndo(setDocs, d, notify, `Đã xóa ${d.title}`) }) },
                  ]} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {!list.length && <EmptyState text={<>Không có tài liệu khớp bộ lọc.</>} art="search" />}
        <Pagination paged={paged} unit="tài liệu" />
      </Panel>

      {view && (
        <Modal
          title={view.title}
          onClose={() => setView(null)}
          footer={<><button className={btnGhost} onClick={() => setView(null)}>Đóng</button><button className={btnPrimary} onClick={() => downloadDoc(view, userName(view.ownerId), departments)}><Download className="h-4 w-4" aria-hidden />{view.url ? 'Tải file' : 'Tải file mẫu'}</button></>}
        >
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-1.5">
              <Chip tone={docVisibility(view.visibility, departments).tone}>{docVisibility(view.visibility, departments).label}</Chip>
              <Chip>{DOC_CATEGORY[view.category]}</Chip>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-[rgb(var(--muted))]">Tóm tắt</p>
              <p className="leading-relaxed text-[rgb(var(--fg))]">{view.summary}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              {[
                ['Phiên bản', view.version],
                ['Cập nhật', fmtDate(view.updatedAt)],
                ['Người phụ trách', userName(view.ownerId)],
                ['Định dạng', `${view.format}, ${view.sizeKb >= 1024 ? `${(view.sizeKb / 1024).toFixed(1)} MB` : `${view.sizeKb} KB`}`],
              ].map(([k, v]) => <div key={k}><dt className="text-xs text-[rgb(var(--muted))]">{k}</dt><dd className="mt-0.5">{v}</dd></div>)}
            </dl>
            {view.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{view.tags.map((t) => <Chip key={t}>{t}</Chip>)}</div>}
          </div>
        </Modal>
      )}
      {uploading && <DocUploadModal onClose={() => setUploading(false)} />}
      {editDoc && <DocUploadModal doc={editDoc} onClose={() => setEditDoc(null)} />}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

