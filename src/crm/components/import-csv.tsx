'use client';

import { useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { FilePicker, Modal } from './ui';
import { btnGhost, btnPrimary, btnSm } from '../lib/core';
import { downloadCsv, parseCsv } from '../lib/csv';
import type { ImportSpec } from '../lib/types';
import { cn } from '../lib/utils';

export function ImportModal<T>({ spec, onClose }: { spec: ImportSpec<T>; onClose: () => void }) {
  const [fileName, setFileName] = useState('');
  const [valid, setValid] = useState<T[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [readError, setReadError] = useState('');

  const handle = async (files: File[]) => {
    const f = files[0];
    setReadError('');
    if (!/\.csv$/i.test(f.name)) {
      setReadError('Chỉ nhận file .csv. Trong Excel chọn Lưu thành > CSV UTF-8 rồi tải lên lại.');
      return;
    }
    setFileName(f.name);
    const rows = parseCsv(await f.text());
    if (rows.length < 2) {
      setValid([]);
      setErrors(['File không có dòng dữ liệu nào bên dưới dòng tiêu đề']);
      return;
    }
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const missing = spec.headers.filter((h) => !header.includes(h));
    if (missing.length) {
      setValid([]);
      setErrors([`Thiếu cột: ${missing.join(', ')}. Hãy dùng file mẫu.`]);
      return;
    }
    const ok: T[] = [];
    const errs: string[] = [];
    rows.slice(1).forEach((r, i) => {
      const rec: Record<string, string> = {};
      header.forEach((h, j) => (rec[h] = (r[j] ?? '').trim()));
      const res = spec.parseRow(rec, i + 2);
      if (res.ok) ok.push(res.item);
      else errs.push(`Dòng ${i + 2}: ${res.error}`);
    });
    setValid(ok);
    setErrors(errs);
  };

  return (
    <Modal
      title={spec.title}
      onClose={onClose}
      footer={
        <>
          <button className={btnGhost} onClick={onClose}>Hủy</button>
          <button className={btnPrimary} disabled={!valid.length} onClick={() => { spec.onImport(valid); onClose(); }}>
            <Upload className="h-4 w-4" aria-hidden />Nhập {valid.length} dòng hợp lệ
          </button>
        </>
      }
    >
      <FilePicker accept=".csv,text/csv" onFiles={handle} className="rounded-md border border-dashed border-[rgb(var(--line))] bg-[rgb(var(--bg))] px-4 py-8 text-center hover:border-[rgb(var(--accent)/0.6)]">
        <FileSpreadsheet className="mx-auto h-8 w-8 text-[rgb(var(--accent))]" aria-hidden />
        <p className="mt-2 text-sm text-[rgb(var(--fg))]">{fileName || 'Chọn file CSV từ máy tính hoặc kéo thả vào đây'}</p>
        <p className="mt-1 text-xs text-[rgb(var(--muted))]">Từ Excel: Tệp &gt; Lưu thành &gt; CSV UTF-8 (phân tách bằng dấu phẩy)</p>
      </FilePicker>
      <button className={cn(btnGhost, btnSm, 'mt-3')} onClick={() => downloadCsv(spec.templateName, [spec.headers, spec.sample])}>
        <Download className="h-3.5 w-3.5" aria-hidden />Tải file mẫu
      </button>
      {readError && <p className="mt-3 text-sm text-[rgb(var(--danger-fg))]">{readError}</p>}
      {fileName && !readError && (
        <div className="mt-4 space-y-2 text-sm">
          <p className="flex items-center gap-2 text-[rgb(var(--success-fg))]"><CheckCircle2 className="h-4 w-4" aria-hidden />{valid.length} dòng hợp lệ</p>
          {errors.length > 0 && (
            <div className="rounded bg-[rgb(var(--danger)/0.1)] p-3">
              <p className="mb-1 text-[rgb(var(--danger-fg))]">{errors.length} dòng bị bỏ qua</p>
              <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs text-[rgb(var(--fg)/0.8)]">
                {errors.slice(0, 50).map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

