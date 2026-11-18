'use client';

import { colName, crc32, xmlEsc } from './core';
import type { XlsxSheet } from './types';

// =====================================================================
//  CSV & FILE HELPERS — đọc dữ liệu tải lên từ máy tính
// =====================================================================

/** Parse CSV (hỗ trợ dấu ngoặc kép, tự nhận dấu phân cách , hoặc ; của Excel tiếng Việt) */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, '');
  const firstLine = s.split(/\r?\n/, 1)[0] ?? '';
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Tải file CSV (có BOM để Excel đọc đúng tiếng Việt) */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob(['\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function zipStore(files: { name: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder(); const parts: Uint8Array[] = []; const central: Uint8Array[] = []; let off = 0;
  for (const f of files) {
    const nm = enc.encode(f.name); const crc = crc32(f.data);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, f.data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + f.data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)] as BlobPart[], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function xlsxBlob(sheets: XlsxSheet[]): Blob {
  const enc = new TextEncoder();
  const sheetXml = (sh: XlsxSheet) => {
    const cols = sh.widths?.length ? `<cols>${sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    const rows = sh.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
      if (v === null || v === undefined || v === '') return '';
      const ref = `${colName(ci)}${ri + 1}`; const st = ri === 0 ? ' s="1"' : '';
      return typeof v === 'number' && Number.isFinite(v) ? `<c r="${ref}"${st || (Math.abs(v) >= 1000 ? ' s="2"' : '')}><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${xmlEsc(String(v))}</t></is></c>`;
    }).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${rows}</sheetData></worksheet>`;
  };
  const files = [
    { name: '[Content_Types].xml', data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`) },
    { name: '_rels/.rels', data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: 'xl/workbook.xml', data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { name: 'xl/styles.xml', data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF172B49"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`) },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(sheetXml(s)) })),
  ];
  return zipStore(files);
}

/** Đọc sheet đầu tiên của file .xlsx thành mảng hàng (chuỗi) */
export async function readXlsx(file: File): Promise<string[][]> {
  const buf = new Uint8Array(await file.arrayBuffer()); const dv = new DataView(buf.buffer);
  let eocd = -1; for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('File không phải định dạng .xlsx');
  const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder(); const entries = new Map<string, { method: number; off: number; size: number }>();
  for (let k = 0; k < n; k++) {
    const method = dv.getUint16(p + 10, true); const size = dv.getUint32(p + 20, true); const nl = dv.getUint16(p + 28, true); const xl = dv.getUint16(p + 30, true); const cl = dv.getUint16(p + 32, true); const off = dv.getUint32(p + 42, true);
    entries.set(dec.decode(buf.subarray(p + 46, p + 46 + nl)), { method, off, size }); p += 46 + nl + xl + cl;
  }
  const read = async (name: string) => {
    const e = entries.get(name); if (!e) return null;
    const start = e.off + 30 + dv.getUint16(e.off + 26, true) + dv.getUint16(e.off + 28, true); const raw = buf.subarray(start, start + e.size);
    if (e.method === 0) return dec.decode(raw);
    if (e.method !== 8 || typeof DecompressionStream === 'undefined') throw new Error('Trình duyệt chưa hỗ trợ giải nén file Excel, hãy lưu dạng CSV');
    const out = await new Response(new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
    return dec.decode(out);
  };
  const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
  const shared: string[] = []; const ss = await read('xl/sharedStrings.xml');
  if (ss) xml(ss).querySelectorAll('si').forEach((si) => shared.push(Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '').join('')));
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const wb = await read('xl/workbook.xml'); const rels = await read('xl/_rels/workbook.xml.rels');
  if (wb && rels) { const rid = xml(wb).getElementsByTagName('sheet')[0]?.getAttribute('r:id'); const t = rid ? Array.from(xml(rels).getElementsByTagName('Relationship')).find((r) => r.getAttribute('Id') === rid)?.getAttribute('Target') : null; if (t) sheetPath = t.startsWith('/') ? t.slice(1) : `xl/${t.replace(/^\.\//, '')}`; }
  const sheet = await read(sheetPath); if (!sheet) throw new Error('Không tìm thấy trang tính trong file');
  const rows: string[][] = [];
  xml(sheet).querySelectorAll('sheetData row').forEach((r) => {
    const ri = Number(r.getAttribute('r') ?? rows.length + 1) - 1; const row: string[] = [];
    r.querySelectorAll('c').forEach((c, idx) => {
      const ref = c.getAttribute('r') ?? ''; const letters = ref.replace(/\d+/g, '');
      const ci = letters ? letters.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1 : idx;
      const t = c.getAttribute('t'); const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      row[ci] = t === 's' ? shared[Number(v)] ?? '' : t === 'inlineStr' ? Array.from(c.getElementsByTagName('t')).map((x) => x.textContent ?? '').join('') : t === 'b' ? (v === '1' ? 'TRUE' : 'FALSE') : v;
    });
    rows[ri] = Array.from({ length: row.length }, (_, i) => row[i] ?? '');
  });
  return rows.filter(Boolean).filter((r) => r.some((c) => String(c).trim()));
}

/** SHA-256 của file — phát hiện nộp trùng chứng từ giữa các claim */
export async function sha256(file: File): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Khớp giá trị nhập (mã hoặc nhãn tiếng Việt) với enum */
export function matchEnum<T extends string>(v: string, labels: Record<T, string>): T | undefined {
  const t = v.trim().toLowerCase();
  if (!t) return undefined;
  return (Object.keys(labels) as T[]).find((k) => k.toLowerCase() === t || labels[k].toLowerCase() === t);
}

