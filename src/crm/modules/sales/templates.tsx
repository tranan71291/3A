'use client';

import { type KeyboardEvent as RKeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Columns3, Download, FileText, ImagePlus, Layers, List, Maximize2, Minimize2, Minus, PenLine, Pencil, Plus, Printer, Redo2, Send, Share2, Stamp, Trash2, Undo2, Wallet, X } from 'lucide-react';
import { Field, FilePicker, useOverlay, useSticky } from '../../components/ui';
import { btnBase, btnGhost, btnPrimary, compact, DOC_CSS, esc, GUARANTEE_LABEL, inputCls, lineVat, missingCompanyInfo, money, RAW_VARS, REQUIRED_VARS, todayISO, TX_CLAUSE, TX_TYPE, useApp, varLabel, VN_DIGITS } from '../../lib/core';
import type { BarAct, ComposerForm, ComposerStep, Customer, DocContext, DocTemplate, GuaranteeType, PreviewAct, SkuItem, TxType } from '../../lib/types';
import { cn } from '../../lib/utils';

export function quoteBody(title: string, clause: string) {
  return `<table class="layout"><tr>
<td>{{company_logo}}<b>{{company_name}}</b><br>MST: {{company_tax_code}}<br>{{company_address}}<br>ĐT: {{company_phone}}</td>
<td class="r">Số: <b>{{doc_code}}</b><br>Ngày: {{doc_date}}</td>
</tr></table>
<h1>BẢNG BÁO GIÁ</h1>
<p class="c"><i>${title}</i></p>
<p>Kính gửi: <b>{{customer_name}}</b><br>MST: {{tax_code}}<br>Địa chỉ: {{customer_address}}<br>Người nhận: {{customer_rep}}, {{customer_rep_title}}</p>
{{#if project}}<p>Dự án / nhu cầu: <b>{{project_name}}</b> ({{project_code}})</p>{{/if}}
<p>{{company_name}} trân trọng gửi Quý khách báo giá như sau:</p>
{{items_table}}
<p><b>Bằng chữ:</b> <i>{{grand_total_words}}</i></p>
<h3>Điều kiện thương mại</h3>
<ul>
<li>Giao hàng: {{delivery_terms}}.</li>
<li>Thanh toán: {{payment_method}}.</li>
{{#if advance}}<li>Tạm ứng {{advance_percent}} giá trị đơn hàng ({{advance_amount}}) sau khi ký hợp đồng.</li>{{/if}}
{{#if credit}}<li>Phần còn lại thanh toán trong {{credit_days}} ngày kể từ ngày giao hàng và nhận hóa đơn.</li>{{/if}}
{{#if no_credit}}<li>Thanh toán 100% trước hoặc khi giao hàng.</li>{{/if}}
{{#if warranty}}<li>Bảo hành {{warranty_months}} tháng theo tiêu chuẩn nhà sản xuất.</li>{{/if}}
<li>${clause}</li>
<li>Báo giá có hiệu lực đến hết ngày {{valid_until}}.</li>
</ul>
{{#if note}}<p>Ghi chú: {{note}}</p>{{/if}}
<table class="layout sign"><tr><td></td><td><b>ĐẠI DIỆN BÊN BÁN</b><br>{{company_stamp}}<br><b>{{company_rep}}</b><br>{{company_rep_title}}</td></tr></table>
<p class="small">Người liên hệ: {{sales_name}}, {{sales_phone}}</p>`;
}

export function contractBody(title: string, clause: string) {
  return `<p class="c"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b>Độc lập – Tự do – Hạnh phúc</b></p>
<h1>HỢP ĐỒNG ${title.toUpperCase()}</h1>
<p class="c">Số: {{contract_code}}</p>
<p class="small">Căn cứ Bộ luật Dân sự số 91/2015/QH13 và Luật Thương mại số 36/2005/QH11; căn cứ nhu cầu và khả năng của hai bên.</p>
<p>Hôm nay, ngày {{doc_date}}, chúng tôi gồm:</p>
<p><b>BÊN A (BÊN MUA): {{customer_name}}</b><br>Địa chỉ: {{customer_address}}<br>Mã số thuế: {{tax_code}}<br>Điện thoại: {{customer_phone}}<br>Đại diện: <b>{{customer_rep}}</b> Chức vụ: {{customer_rep_title}}</p>
<p><b>BÊN B (BÊN BÁN): {{company_name}}</b><br>Địa chỉ: {{company_address}}<br>Mã số thuế: {{company_tax_code}}<br>Tài khoản: {{company_bank}}<br>Đại diện: <b>{{company_rep}}</b> Chức vụ: {{company_rep_title}}</p>
<p>Hai bên thống nhất ký kết hợp đồng với các điều khoản sau:</p>
<h3 class="art">Hàng hóa, số lượng và giá trị hợp đồng</h3>
{{#if project}}<p>Hàng hóa cung cấp cho: {{project_name}} ({{project_code}}).</p>{{/if}}
{{items_table}}
<p>Giá trị hợp đồng bằng chữ: <i>{{grand_total_words}}</i>.</p>
<h3 class="art">Giao hàng và nghiệm thu</h3>
<p>{{delivery_terms}}. Hai bên ký biên bản giao nhận khi giao hàng; hàng hóa đúng chủng loại, số lượng và còn nguyên đai kiện.</p>
<h3 class="art">Thanh toán</h3>
<p>Hình thức thanh toán: {{payment_method}}.</p>
{{#if advance}}<p>Bên A tạm ứng {{advance_percent}} giá trị hợp đồng ({{advance_amount}}) trong 05 ngày làm việc kể từ ngày ký hợp đồng.</p>{{/if}}
{{#if credit}}<p>Bên A thanh toán phần giá trị còn lại trong vòng {{credit_days}} ngày kể từ ngày nhận hàng và hóa đơn GTGT hợp lệ.</p>{{/if}}
{{#if no_credit}}<p>Bên A thanh toán 100% giá trị trước hoặc ngay khi nhận hàng.</p>{{/if}}
{{#if guarantee}}<h3 class="art">Bảo lãnh</h3>
<p>{{guarantee_terms}}</p>{{/if}}
{{#if warranty}}<h3 class="art">Bảo hành</h3>
<p>Hàng hóa được bảo hành {{warranty_months}} tháng kể từ ngày giao hàng theo tiêu chuẩn của nhà sản xuất. Bảo hành không áp dụng cho hư hỏng do lắp đặt, sử dụng sai hướng dẫn.</p>{{/if}}
<h3 class="art">Điều khoản riêng</h3>
<p>${clause}</p>
{{#if note}}<p>{{note}}</p>{{/if}}
<h3 class="art">Điều khoản chung</h3>
<p>Hai bên cam kết thực hiện đúng các điều khoản của hợp đồng. Tranh chấp phát sinh được giải quyết trên cơ sở thương lượng; nếu không thương lượng được sẽ đưa ra Tòa án có thẩm quyền giải quyết. Hợp đồng có hiệu lực kể từ ngày ký, được lập thành 04 bản có giá trị pháp lý như nhau, mỗi bên giữ 02 bản.</p>
<table class="layout sign"><tr>
<td><b>ĐẠI DIỆN BÊN A</b><br><br><br><br><b>{{customer_rep}}</b><br>{{customer_rep_title}}</td>
<td><b>ĐẠI DIỆN BÊN B</b><br>{{company_stamp}}<br><b>{{company_rep}}</b><br>{{company_rep_title}}</td>
</tr></table>`;
}

/** 10 mẫu báo giá + 10 mẫu hợp đồng, ghép cặp theo loại giao dịch */
export function initialDocTemplates(): DocTemplate[] {
  const today = todayISO(); // v61: theo giờ máy (không lùi 1 ngày trước 7h sáng)
  const contractTitle: Record<TxType, string> = {
    DEALER: 'Đại lý phân phối', PROJECT_ME: 'Mua bán hàng hóa dự án M&E', SUPPLY_INSTALL: 'Cung cấp và lắp đặt', RETAIL_CASH: 'Mua bán hàng hóa',
    FACTORY: 'Mua bán vật tư công nghiệp', EPC_SUB: 'Cung cấp vật tư cho Tổng thầu', FRAMEWORK: 'Nguyên tắc mua bán hàng hóa', SAMPLE: 'Cung cấp mẫu thử nghiệm',
    SERVICE: 'Dịch vụ bảo trì kỹ thuật', TRADING: 'Mua bán hàng hóa (bán buôn)',
  };
  return (Object.keys(TX_TYPE) as TxType[]).flatMap((t, i) => {
    const n = String(i + 1).padStart(2, '0');
    const base = { txType: t, standardCreditDays: TX_TYPE[t].credit, defaultTier: TX_TYPE[t].tier, defaultDelivery: TX_TYPE[t].delivery, system: true, updatedAt: today };
    return [
      { ...base, id: `tq${n}`, kind: 'QUOTE', name: `Báo giá ${TX_TYPE[t].label}`, pairId: `tc${n}`, body: quoteBody(TX_TYPE[t].label, TX_CLAUSE[t].quote) },
      { ...base, id: `tc${n}`, kind: 'CONTRACT', name: `Hợp đồng ${contractTitle[t]}`, body: contractBody(contractTitle[t], TX_CLAUSE[t].contract) },
    ] as DocTemplate[];
  });
}

export function readTriple(n: number, full: boolean): string {
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), u = n % 10;
  const out: string[] = [];
  if (h > 0 || full) out.push(`${VN_DIGITS[h]} trăm`);
  if (t === 0) {
    if (u > 0) out.push(h > 0 || full ? `linh ${VN_DIGITS[u]}` : VN_DIGITS[u]);
  } else if (t === 1) {
    out.push('mười');
    if (u === 5) out.push('lăm');
    else if (u > 0) out.push(VN_DIGITS[u]);
  } else {
    out.push(`${VN_DIGITS[t]} mươi`);
    if (u === 1) out.push('mốt');
    else if (u === 4) out.push('tư');
    else if (u === 5) out.push('lăm');
    else if (u > 0) out.push(VN_DIGITS[u]);
  }
  return out.join(' ');
}

/** 1.250.000 -> "Một triệu hai trăm năm mươi nghìn đồng" */
export function moneyToWordsVN(amount: number): string {
  let n = Math.round(Math.abs(amount));
  if (!n) return 'Không đồng';
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const groups: number[] = [];
  while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (!groups[i]) continue;
    parts.push(`${readTriple(groups[i], i < groups.length - 1)}${units[i] ? ` ${units[i]}` : ''}`);
  }
  const s = `${parts.join(' ')} đồng`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Nhóm thuế suất: [thuế suất, tiền hàng, tiền thuế], tăng dần */
export function vatGroups(f: ComposerForm): [number, number, number][] {
  const by = new Map<number, number>();
  f.items.forEach((l) => { const r = lineVat(f, l); by.set(r, (by.get(r) ?? 0) + l.qty * l.price); });
  if (!by.size) by.set(f.vatPct, 0);
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([r, b]) => [r, b, Math.round((b * r) / 100)]);
}

export function docTotals(f: ComposerForm) {
  const sub = f.items.reduce((a, l) => a + l.qty * l.price, 0);
  const groups = vatGroups(f);
  const vat = groups.reduce((a, g) => a + g[2], 0);
  const grand = sub + vat;
  return { sub, vat, grand, groups, mixed: groups.length > 1, advance: Math.round((grand * f.advancePct) / 100), guarantee: Math.round((grand * f.guaranteePct) / 100) };
}

/** v38.7: bảng hàng đầy đủ theo mẫu báo giá thiết bị vật tư (VAT từng dòng, hãng SX lấy từ danh mục sản phẩm) */
export function itemsTableFullHtml(f: ComposerForm, skus: SkuItem[] = []) {
  const t = docTotals(f);
  const n0 = (v: number) => Math.round(v).toLocaleString('vi-VN');
  const rows = f.items.map((l, i) => {
    const amount = l.qty * l.price, vat = Math.round((amount * lineVat(f, l)) / 100);
    return `<tr><td class="c">${i + 1}</td><td class="c">${esc(l.sku)}</td><td>${esc(l.name)}</td><td class="c">${esc(skus.find((x) => x.sku === l.sku)?.brand ?? '')}</td><td class="c">${esc(l.unit)}</td><td class="c">${l.qty.toLocaleString('vi-VN')}</td><td class="r">${n0(l.price)}</td><td class="r">${n0(vat)}</td><td class="r">${n0(amount + vat)}</td><td>${esc([l.discountPct ? `CK ${l.discountPct}%` : '', f.vatMode === 'LINE' ? `VAT ${lineVat(f, l)}%` : '', l.note?.trim() ?? ''].filter(Boolean).join('; '))}</td></tr>`;
  }).join('');
  return `<table class="items items-full"><thead><tr><th>STT</th><th>MÃ HÀNG</th><th>HẠNG MỤC</th><th>HÃNG SX</th><th>ĐƠN VỊ</th><th>SỐ LƯỢNG</th><th>ĐƠN GIÁ</th><th>${t.mixed ? 'VAT' : `VAT ${f.vatPct}%`}</th><th>THÀNH TIỀN</th><th>GHI CHÚ</th></tr></thead><tbody>${rows || '<tr><td colspan="10" class="c">Chưa có hàng hóa</td></tr>'}
<tr class="total"><td colspan="7" class="c"><b>TỔNG TIỀN CÓ VAT</b></td><td class="r"><b>${n0(t.vat)}</b></td><td class="r"><b>${n0(t.grand)}</b></td><td class="c"><b>VND</b></td></tr></tbody></table>`;
}

export function itemsTableHtml(f: ComposerForm) {
  const t = docTotals(f);
  const n0 = (v: number) => Math.round(v).toLocaleString('vi-VN');
  const hasNote = f.items.some((l) => l.note?.trim());
  const cols = 7 + (t.mixed ? 1 : 0) + (hasNote ? 1 : 0);
  const rows = f.items.map((l, i) => `<tr><td class="c">${i + 1}</td><td>${esc(l.sku)}</td><td>${esc(l.name)}</td><td class="c">${esc(l.unit)}</td><td class="r">${l.qty.toLocaleString('vi-VN')}</td><td class="r">${n0(l.price)}</td>${t.mixed ? `<td class="c">${lineVat(f, l)}%</td>` : ''}<td class="r">${n0(l.qty * l.price)}</td>${hasNote ? `<td>${esc(l.note ?? '')}</td>` : ''}</tr>`).join('');
  const span = cols - 1 - (hasNote ? 1 : 0);
  const tail = (label: string, v: string, bold = false) => `<tr><td colspan="${span}" class="r">${bold ? `<b>${label}</b>` : label}</td><td class="r">${bold ? `<b>${v}</b>` : v}</td>${hasNote ? '<td></td>' : ''}</tr>`;
  const vatRows = t.groups.map(([r, base, v]) => tail(t.mixed ? `Thuế GTGT ${r}% (trên ${n0(base)})` : `Thuế GTGT ${r}%`, n0(v))).join('');
  return `<table class="items"><thead><tr><th>STT</th><th>Mã hàng</th><th>Tên hàng hóa, quy cách</th><th>ĐVT</th><th>SL</th><th>Đơn giá (đ)</th>${t.mixed ? '<th>VAT</th>' : ''}<th>Thành tiền (đ)</th>${hasNote ? '<th>Ghi chú</th>' : ''}</tr></thead><tbody>${rows || `<tr><td colspan="${cols}" class="c">Chưa có hàng hóa</td></tr>`}
${tail('Cộng tiền hàng', n0(t.sub))}
${vatRows}
${tail('Tổng cộng thanh toán', n0(t.grand), true)}</tbody></table>`;
}

export function buildDocVars(f: ComposerForm, x: DocContext) {
  const t = docTotals(f);
  const today = new Date();
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const img = (src?: string, h = 90) => (src ? `<img src="${src}" alt="" style="height:${h}px;max-width:220px;object-fit:contain;display:block;margin:6px auto">` : '<br><br><br>');
  const vars: Record<string, string> = {
    doc_code: x.quoteCode,
    contract_code: x.contractCode,
    doc_date: fmt(today),
    valid_until: fmt(new Date(today.getTime() + f.validDays * 864e5)),
    company_name: x.company.legalName,
    company_tax_code: x.company.taxCode,
    company_address: x.company.address,
    company_phone: x.company.phone,
    company_rep: x.company.representative,
    company_rep_title: x.company.representativeTitle,
    company_bank: [x.company.bankAccount, x.company.bankName].filter(Boolean).join(' tại '),
    company_branches: (x.company.branches ?? []).filter((b) => b.print && b.name.trim()).map((b) => `${b.name}: ${b.address}`).join('; '),
    company_logo: x.company.logo ? `<img src="${x.company.logo}" alt="" style="height:48px;display:block;margin-bottom:6px">` : '',
    company_stamp: img(x.company.stamp),
    customer_name: f.party.name,
    tax_code: f.party.taxCode,
    customer_address: f.party.address,
    customer_rep: f.party.rep,
    customer_rep_title: `${f.party.repTitle}${f.party.authDoc?.trim() ? ` (theo giấy ủy quyền số ${f.party.authDoc.trim()})` : ''}`,
    customer_phone: f.party.phone,
    customer_email: f.party.email,
    project_name: x.projectName ?? '',
    project_code: x.projectCode ?? '',
    items_table: itemsTableHtml(f),
    items_table_full: itemsTableFullHtml(f, x.skus),
    doc_date_long: `ngày ${String(today.getDate()).padStart(2, '0')} tháng ${String(today.getMonth() + 1).padStart(2, '0')} năm ${today.getFullYear()}`,
    doc_revision: String(x.revision ?? 1),
    sales_email: x.salesEmail ?? '',
    subtotal: money(t.sub),
    vat_rate: t.mixed ? t.groups.map((g) => `${g[0]}%`).join(', ') : `${f.vatPct}%`,
    vat_amount: money(t.vat),
    grand_total: money(t.grand),
    grand_total_words: moneyToWordsVN(t.grand),
    delivery_terms: f.delivery,
    advance_percent: `${f.advancePct}%`,
    advance_amount: money(t.advance),
    guarantee_terms: f.guaranteeType === 'NONE' ? '' : `Bên B nộp cho Bên A ${GUARANTEE_LABEL[f.guaranteeType].toLowerCase()} trị giá ${f.guaranteePct}% giá trị hợp đồng (${money(t.guarantee)}) do ngân hàng hoạt động hợp pháp tại Việt Nam phát hành.`,
    warranty_months: f.warrantyMonths > 0 ? String(f.warrantyMonths) : '__STD__',
    credit_days: String(f.creditDays),
    payment_method: f.paymentMethod,
    note: f.note,
    sales_name: x.salesName,
    sales_phone: x.salesPhone,
  };
  const flags: Record<string, boolean> = {
    advance: f.advancePct > 0, credit: f.creditDays > 0, no_credit: f.creditDays === 0, guarantee: f.guaranteeType !== 'NONE',
    warranty: f.warrantyMonths > 0, project: !!x.projectName, note: !!f.note.trim(),
  };
  return { vars, flags };
}

export function renderTemplate(body: string, vars: Record<string, string>, flags: Record<string, boolean>) {
  let out = body.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_m, k: string, inner: string) => (flags[k] ? inner : ''));
  out = out.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (!(k in vars) ? `<span class="missing">${m}</span>` : REQUIRED_VARS.has(k) && !String(vars[k] ?? '').trim() ? `<span class="missing">[${esc(varLabel(k))}]</span>` : RAW_VARS.has(k) ? vars[k] : esc(vars[k])));
  let n = 0;
  // v45: bảo hành 0 tháng = theo tiêu chuẩn nhà sản xuất
  out = out.replace(/__STD__ tháng kể từ ngày giao hàng theo tiêu chuẩn của nhà sản xuất/g, 'theo tiêu chuẩn của nhà sản xuất, tính từ ngày giao hàng')
    .replace(/__STD__ tháng theo tiêu chuẩn (của )?nhà sản xuất/g, 'theo tiêu chuẩn $1nhà sản xuất').replace(/__STD__ tháng/g, 'theo tiêu chuẩn nhà sản xuất').replace(/__STD__/g, 'theo tiêu chuẩn nhà sản xuất');
  return out.replace(/<h3 class="art">/g, () => `<h3>Điều ${++n}. `);
}

export function docShell(title: string, body: string) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${DOC_CSS}</style></head><body><div class="page">${body}</div></body></html>`;
}

/** PDF: in qua iframe ẩn, người dùng chọn "Lưu dưới dạng PDF" */
export function printHtml(html: string) {
  const f = document.createElement('iframe');
  Object.assign(f.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  f.srcdoc = html;
  f.onload = () => {
    f.contentWindow?.focus();
    f.contentWindow?.print();
    setTimeout(() => f.remove(), 2000);
  };
  document.body.appendChild(f);
}

/** Word: HTML có khai báo Office, mở và sửa được bằng Microsoft Word (.doc) */
export function downloadWord(fileBase: string, title: string, body: string) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(title)}</title><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]--><style>${DOC_CSS}</style></head><body>${body}</body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + html], { type: 'application/msword' }));
  a.download = `${fileBase.replace(/[\\/:*?"<>|\s]+/g, '_')}.doc`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Đọc nội dung chữ từ file .docx (đọc ZIP + giải nén word/document.xml bằng DecompressionStream của trình duyệt) */
export async function readDocxParagraphs(file: File): Promise<string[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('File không đúng định dạng .docx');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    if (name === 'word/document.xml') {
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const data = buf.slice(start, start + csize);
      let xml: string;
      if (method === 0) xml = new TextDecoder().decode(data);
      else if (method === 8) {
        if (typeof DecompressionStream === 'undefined') throw new Error('Trình duyệt chưa hỗ trợ giải nén, hãy dùng Chrome / Edge / Safari mới');
        xml = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
      } else throw new Error('Kiểu nén trong file .docx không được hỗ trợ');
      const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      return Array.from(doc.getElementsByTagNameNS(W, 'p')).map((el) => Array.from(el.getElementsByTagNameNS(W, 't')).map((t) => t.textContent ?? '').join(''));
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('Không tìm thấy nội dung văn bản trong file .docx');
}

/** Điều khoản cần Trưởng phòng / Giám đốc duyệt trước khi xuất hợp đồng */
export function specialTermsOf(f: ComposerForm, tpl: DocTemplate | undefined, customer: Customer | undefined, skus: SkuItem[]): string[] {
  const out: string[] = [];
  const t = docTotals(f);
  const std = tpl?.standardCreditDays ?? TX_TYPE[f.txType].credit;
  if (f.creditDays > std) out.push(`Công nợ ${f.creditDays} ngày, vượt mức chuẩn ${std} ngày của mẫu hợp đồng`);
  if (customer && customer.creditLimit > 0 && customer.debt + t.grand > customer.creditLimit) out.push(`Vượt hạn mức công nợ của khách: nợ hiện tại ${compact(customer.debt)} + hợp đồng ${compact(t.grand)} > hạn mức ${compact(customer.creditLimit)}`);
  const belowCost = f.items.filter((l) => { const k = skus.find((s) => s.sku === l.sku); return !!k && k.costPrice > 0 && l.price < k.costPrice; }).length;
  if (belowCost) out.push(`${belowCost} dòng hàng có đơn giá thấp hơn giá vốn`);
  return out;
}

/** Mục lục "Điều N. …" lấy từ HTML đã dựng (mẫu do người dùng soạn nên chỉ nhận dạng theo chữ "Điều N") */
export function docOutline(html: string): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const text = html.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ');
  for (const m of text.matchAll(/(?:^|\n)\s*(Điều\s+(\d+))\s*[.:]?\s*([^\n:.]{0,48})/g)) {
    const key = `Điều ${m[2]}`;
    if (out.some((x) => x.key === key)) continue;
    out.push({ key, label: `${key}. ${m[3].trim()}`.replace(/[.\s]+$/, '') });
  }
  return out;
}

/** v45: tạo file PDF khổ A4 từ nội dung tài liệu (dựng trang ẩn, chụp bằng html2canvas, ghép trang bằng jsPDF) */
export async function docPdfBlob(title: string, html: string): Promise<Blob> {
  const [{ jsPDF }, h2c] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const html2canvas = h2c.default;
  const f = document.createElement('iframe');
  Object.assign(f.style, { position: 'fixed', left: '-10000px', top: '0', width: '840px', height: '1200px', border: '0' });
  document.body.appendChild(f);
  try {
    await new Promise<void>((res) => { f.onload = () => res(); f.srcdoc = docShell(title, html).replace('</head>', '<style>html,body{background:#fff!important;padding:0!important;margin:0}.page{box-shadow:none!important;margin:0!important}</style></head>'); });
    const d = f.contentDocument;
    const page = d?.querySelector('.page') as HTMLElement | null;
    if (!d || !page) throw new Error('no_page');
    await Promise.all(Array.from(d.images).map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = () => r(null); }))));
    const canvas = await html2canvas(page, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const pw = 210, ph = 297;
    const sliceH = Math.floor((canvas.width * ph) / pw);
    for (let y = 0, i = 0; y < canvas.height; y += sliceH, i++) {
      const c = document.createElement('canvas');
      c.width = canvas.width; c.height = Math.min(sliceH, canvas.height - y);
      const g = c.getContext('2d');
      if (!g) break;
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(canvas, 0, y, canvas.width, c.height, 0, 0, canvas.width, c.height);
      if (i) pdf.addPage();
      pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, pw, (c.height * pw) / canvas.width);
    }
    return pdf.output('blob');
  } finally { f.remove(); }
}

/** v45: thanh soạn thảo khi sửa trực tiếp trên bản xem trước */
/** v48: ảnh nổi trong trang: vị trí tính từ góc vùng nội dung (biến --pl / --pt theo lề trang), nên in / PDF đúng chỗ */
export function placeFloat(el: HTMLImageElement, x: number, y: number) {
  el.dataset.x = String(Math.round(x)); el.dataset.y = String(Math.round(y));
  // Gắn theo ô (con dấu ở ô ký, logo): tọa độ tính từ ô đó nên chữ dàn lại khi in cũng không lệch
  if (el.dataset.anchor === 'cell') { el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(y)}px`; return; }
  el.style.left = `calc(var(--pl, 16mm) + ${Math.round(x)}px)`; el.style.top = `calc(var(--pt, 18mm) + ${Math.round(y)}px)`;
}

export function DocEditBar({ frame, kind }: { frame: { current: HTMLIFrameElement | null }; kind?: 'QUOTE' | 'CONTRACT' }) {
  const { notify, company } = useApp();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [fl, setFl] = useState<HTMLImageElement | null>(null);
  const dragR = useRef<{ el: HTMLImageElement; sx: number; sy: number; x: number; y: number; k: number } | null>(null);
  const [inTable, setInTable] = useState(false);
  const doc = () => frame.current?.contentDocument ?? null;
  useEffect(() => {
    const d = doc();
    if (!d) return;
    const onSel = () => {
      const n = d.getSelection()?.anchorNode;
      const el = (n && (n.nodeType === 1 ? n : n.parentElement)) as HTMLElement | null;
      setInTable(!!el?.closest?.('td,th'));
    };
    const onClick = (e: MouseEvent) => { const t = e.target as HTMLElement; const isF = t.tagName === 'IMG' && t.hasAttribute('data-float'); setImg(t.tagName === 'IMG' && !isF ? (t as HTMLImageElement) : null); pickFl(isF ? (t as HTMLImageElement) : null); onSel(); };
    // Kéo ảnh nổi: đổi tọa độ chuột (đã nhân tỉ lệ thu phóng) về đơn vị CSS của trang
    const down = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName !== 'IMG' || !t.hasAttribute('data-float')) return;
      e.preventDefault();
      const el = t as HTMLImageElement;
      const page = d.querySelector('.page') as HTMLElement | null;
      const k = page ? page.getBoundingClientRect().width / Math.max(1, page.offsetWidth) : 1;
      dragR.current = { el, sx: e.clientX, sy: e.clientY, x: Number(el.dataset.x ?? 0), y: Number(el.dataset.y ?? 0), k: k || 1 };
      pickFl(el);
    };
    const move = (e: PointerEvent) => { const g = dragR.current; if (!g) return; e.preventDefault(); placeFloat(g.el, g.x + (e.clientX - g.sx) / g.k, g.y + (e.clientY - g.sy) / g.k); };
    const up = () => { dragR.current = null; };
    const key = (e: KeyboardEvent) => {
      const el = d.querySelector('img[data-float].on') as HTMLImageElement | null;
      if (!el) return;
      const st = e.shiftKey ? 10 : 1;
      const mv: Record<string, [number, number]> = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] };
      if (mv[e.key]) { e.preventDefault(); placeFloat(el, Number(el.dataset.x ?? 0) + mv[e.key][0], Number(el.dataset.y ?? 0) + mv[e.key][1]); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); el.remove(); pickFl(null); }
    };
    d.addEventListener('selectionchange', onSel);
    d.addEventListener('click', onClick);
    d.addEventListener('pointerdown', down);
    d.addEventListener('pointermove', move);
    d.addEventListener('pointerup', up);
    d.addEventListener('keydown', key);
    return () => { d.removeEventListener('selectionchange', onSel); d.removeEventListener('click', onClick); d.removeEventListener('pointerdown', down); d.removeEventListener('pointermove', move); d.removeEventListener('pointerup', up); d.removeEventListener('keydown', key); };
  });
  const pickFl = (el: HTMLImageElement | null) => { doc()?.querySelectorAll('img[data-float].on').forEach((x) => x.classList.remove('on')); el?.classList.add('on'); setFl(el); };
  /** Tọa độ của phần tử so với góc vùng nội dung trang (đơn vị CSS) */
  const posOf = (el: HTMLElement, page: HTMLElement) => {
    let x = 0, y = 0;
    let n: HTMLElement | null = el;
    while (n && n !== page) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent as HTMLElement | null; }
    const cs = page.ownerDocument.defaultView?.getComputedStyle(page);
    return { x: x - parseFloat(cs?.paddingLeft ?? '0'), y: y - parseFloat(cs?.paddingTop ?? '0'), w: el.offsetWidth, h: el.offsetHeight, cw: page.clientWidth - parseFloat(cs?.paddingLeft ?? '0') - parseFloat(cs?.paddingRight ?? '0') };
  };
  /** Thêm ảnh nổi; where: vị trí gợi ý (đầu trang / ô ký bên bán) */
  const addFloat = (src: string, where: 'TOP' | 'LOGO' | 'SELLER', width = 150) => {
    const d = doc();
    const page = d?.querySelector('.page') as HTMLElement | null;
    if (!d || !page) return;
    const el = d.createElement('img');
    el.src = src; el.alt = ''; el.setAttribute('data-float', where === 'TOP' ? 'image' : 'stamp'); el.setAttribute('draggable', 'false'); el.setAttribute('contenteditable', 'false');
    el.style.width = `${width}px`; el.style.zIndex = '5';
    if (where !== 'TOP') el.style.mixBlendMode = 'multiply';
    const box = posOf(page, page);
    let x = Math.max(0, box.cw - width - 10), y = 0;
    let host: HTMLElement = page;
    if (where === 'LOGO') {
      const logo = Array.from(page.querySelectorAll('img:not([data-float])')).find((im) => posOf(im as HTMLElement, page).y < 220) as HTMLImageElement | undefined;
      const box2 = logo?.parentElement;
      if (logo && box2) { box2.style.position = 'relative'; host = box2; el.dataset.anchor = 'cell'; x = logo.offsetLeft + logo.offsetWidth * 0.45; y = logo.offsetTop - width * 0.25; } else { x = 0; y = -10; }
    }
    if (where === 'SELLER') {
      const heads = Array.from(page.querySelectorAll('b,strong,th,td')).filter((n) => /^ĐẠI DIỆN BÊN (BÁN|B)$/i.test((n.textContent ?? '').replace(/\s+/g, ' ').trim()));
      const head = heads[heads.length - 1] as HTMLElement | undefined;
      const cell = (head?.closest('td,th') as HTMLElement | null) ?? head;
      if (cell && head) {
        // ảnh mộc in sẵn trong ô ký (từ mẫu) chuyển thành ảnh nổi để kéo chỉnh, không bị trùng
        let gap = 0;
        cell.querySelectorAll('img:not([data-float])').forEach((im) => { if ((im as HTMLImageElement).src === src || /mộc|stamp/i.test((im as HTMLImageElement).alt)) { const sp = d.createElement('div'); sp.setAttribute('data-stamp-space', ''); sp.style.height = `${(im as HTMLImageElement).offsetHeight || 90}px`; im.replaceWith(sp); gap = 1; } });
        // giữ chỗ trống cho chữ ký / con dấu giữa tiêu đề và tên người đại diện
        if (!gap && !cell.querySelector('[data-stamp-space]')) { const sp = d.createElement('div'); sp.setAttribute('data-stamp-space', ''); sp.style.height = `${Math.round(width * 0.6)}px`; head.after(sp); }
        cell.style.position = 'relative'; host = cell; el.dataset.anchor = 'cell';
        x = cell.clientWidth / 2 - width * 0.75; y = head.offsetTop + head.offsetHeight + 2;
      } else { x = Math.max(0, box.cw - width - 20); y = Math.max(0, page.scrollHeight - 260); }
    }
    if (where === 'LOGO') page.querySelectorAll('table.sign img:not([data-float])').forEach((im) => { if ((im as HTMLImageElement).src === src) im.remove(); });
    placeFloat(el, x, y);
    host.appendChild(el);
    pickFl(el);
  };
  const readImg = (files: File[], then: (src: string) => void) => {
    const file = files[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 3 * 1024 * 1024) return notify('Ảnh tối đa 3 MB', 'orange');
    const r = new FileReader();
    r.onload = () => then(String(r.result));
    r.readAsDataURL(file);
  };
  const stampWhere = kind === 'CONTRACT' ? 'SELLER' : 'LOGO';
  const stampTip = kind === 'CONTRACT' ? 'đặt vào ô Đại diện bên bán' : 'đặt ở đầu trang, đè lên góc logo';
  const flSize = (k: number) => { if (!fl) return; fl.style.width = `${Math.max(30, Math.min(700, Math.round(fl.offsetWidth * k)))}px`; };
  const flLayer = (under: boolean) => { if (!fl) return; fl.style.zIndex = under ? '-1' : '5'; };
  const run = (cmd: string, val?: string) => { const d = doc(); if (!d) return; d.execCommand(cmd, false, val); (d.querySelector('.page') as HTMLElement | null)?.focus(); };
  const cellOf = () => { const n = doc()?.getSelection()?.anchorNode; const el = (n && (n.nodeType === 1 ? n : n.parentElement)) as HTMLElement | null; return el?.closest?.('td,th') as HTMLTableCellElement | null; };
  const addTable = () => {
    const cols = 3, rows = 3;
    const td = 'border:1px solid #333;padding:4px 6px;min-width:40px';
    const head = `<tr>${Array.from({ length: cols }, (_, i) => `<th style="${td};background:#f2f2f2">Cột ${i + 1}</th>`).join('')}</tr>`;
    const body = Array.from({ length: rows - 1 }, () => `<tr>${Array.from({ length: cols }, () => `<td style="${td}">&nbsp;</td>`).join('')}</tr>`).join('');
    run('insertHTML', `<table style="width:100%;border-collapse:collapse;margin:6px 0">${head}${body}</table><p><br></p>`);
  };
  const rowOp = (add: boolean) => { const c = cellOf(); const tr = c?.parentElement as HTMLTableRowElement | null; if (!tr) return; if (add) { const n = tr.cloneNode(true) as HTMLTableRowElement; n.querySelectorAll('td,th').forEach((x) => { x.innerHTML = '&nbsp;'; }); tr.after(n); } else tr.remove(); };
  const colOp = (add: boolean) => { const c = cellOf(); const t = c?.closest('table'); if (!c || !t) return; const i = c.cellIndex; t.querySelectorAll('tr').forEach((tr) => { const x = (tr as HTMLTableRowElement).cells[i]; if (!x) return; if (add) { const n = x.cloneNode(false) as HTMLElement; n.innerHTML = '&nbsp;'; x.after(n); } else x.remove(); }); };
  const delTable = () => { const t = cellOf()?.closest('table'); if (t) { t.remove(); setInTable(false); } };
  const pickImage = (files: File[]) => {
    const file = files[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 3 * 1024 * 1024) return notify('Ảnh tối đa 3 MB', 'orange');
    const r = new FileReader();
    r.onload = () => run('insertHTML', `<img src="${String(r.result)}" alt="" style="max-width:100%;width:50%;height:auto;display:block;margin:6px 0">`);
    r.readAsDataURL(file);
  };
  const b = 'inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-md px-1.5 text-xs text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.06)] hover:text-[rgb(var(--fg))]';
  const btn = (label: string, on: () => void, child: ReactNode) => <button type="button" className={b} title={label} aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={on}>{child}</button>;
  const sep = <span className="mx-0.5 h-4 w-px bg-[rgb(var(--line))]" aria-hidden />;
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-[rgb(var(--accent)/0.3)] bg-[rgb(var(--accent)/0.06)] px-2 py-1" role="toolbar" aria-label="Định dạng văn bản">
      {btn('Hoàn tác', () => run('undo'), <Undo2 className="h-3.5 w-3.5" />)}{btn('Làm lại', () => run('redo'), <Redo2 className="h-3.5 w-3.5" />)}{sep}
      {btn('In đậm', () => run('bold'), <b className="text-[13px]">B</b>)}{btn('In nghiêng', () => run('italic'), <i className="font-serif text-[13px]">I</i>)}{btn('Gạch chân', () => run('underline'), <u className="text-[13px]">U</u>)}
      {btn('Tiêu đề', () => run('formatBlock', 'H3'), <span className="text-[12px] font-semibold">H</span>)}{btn('Đoạn thường', () => run('formatBlock', 'P'), <span className="text-[12px]">¶</span>)}{sep}
      {btn('Danh sách chấm', () => run('insertUnorderedList'), <List className="h-3.5 w-3.5" />)}{btn('Danh sách số', () => run('insertOrderedList'), <span className="font-mono text-[11px]">1.</span>)}
      {btn('Căn trái', () => run('justifyLeft'), <span className="text-[11px]">Trái</span>)}{btn('Căn giữa', () => run('justifyCenter'), <span className="text-[11px]">Giữa</span>)}{btn('Căn phải', () => run('justifyRight'), <span className="text-[11px]">Phải</span>)}{sep}
      <FilePicker accept="image/*" onFiles={pickImage} className={b}><ImagePlus className="h-3.5 w-3.5" aria-hidden />Ảnh</FilePicker>
      <FilePicker accept="image/png,image/webp,image/*" onFiles={(fs) => readImg(fs, (src) => addFloat(src, 'TOP', 160))} className={b}><Layers className="h-3.5 w-3.5" aria-hidden />Ảnh nổi</FilePicker>
      {company.stamp ? btn(`Chèn con dấu & chữ ký công ty: ${stampTip}`, () => addFloat(company.stamp!, stampWhere, kind === 'CONTRACT' ? 150 : 120), <><Stamp className="h-3.5 w-3.5" />Dấu & ký</>) : null}
      <FilePicker accept="image/png,image/webp,image/*" onFiles={(fs) => readImg(fs, (src) => addFloat(src, stampWhere, kind === 'CONTRACT' ? 150 : 120))} className={b}><PenLine className="h-3.5 w-3.5" aria-hidden />{company.stamp ? 'Dấu / ký khác' : 'Chèn dấu & ký'}</FilePicker>
      {btn('Chèn bảng 3 × 3', addTable, <><Columns3 className="h-3.5 w-3.5" />Bảng</>)}
      {inTable && <>{sep}{btn('Thêm dòng dưới', () => rowOp(true), <span className="text-[11px]">+ Dòng</span>)}{btn('Xóa dòng', () => rowOp(false), <span className="text-[11px]">− Dòng</span>)}{btn('Thêm cột phải', () => colOp(true), <span className="text-[11px]">+ Cột</span>)}{btn('Xóa cột', () => colOp(false), <span className="text-[11px]">− Cột</span>)}{btn('Xóa bảng', delTable, <span className="text-[11px] text-[rgb(var(--danger-fg))]">Xóa bảng</span>)}</>}
      {img && <>{sep}<span className="px-1 text-[11px] text-[rgb(var(--muted))]">Cỡ ảnh</span>{[25, 50, 75, 100].map((w) => btn(`Ảnh rộng ${w}%`, () => { img.style.width = `${w}%`; img.style.maxWidth = '100%'; img.style.height = 'auto'; }, <span className="text-[11px]">{w}%</span>))}{btn('Căn giữa ảnh', () => { img.style.marginLeft = 'auto'; img.style.marginRight = 'auto'; img.style.display = 'block'; }, <span className="text-[11px]">Giữa</span>)}{btn('Xóa ảnh', () => { img.remove(); setImg(null); }, <span className="text-[11px] text-[rgb(var(--danger-fg))]">Xóa ảnh</span>)}</>}
      {fl && <>{sep}<span className="px-1 text-[11px] text-[rgb(var(--muted))]">Ảnh nổi</span>{btn('Nhỏ hơn', () => flSize(0.9), <Minus className="h-3.5 w-3.5" />)}{btn('Lớn hơn', () => flSize(1.1), <Plus className="h-3.5 w-3.5" />)}{btn('Đặt trên chữ', () => flLayer(false), <span className="text-[11px]">Trên chữ</span>)}{btn('Đặt dưới chữ', () => flLayer(true), <span className="text-[11px]">Dưới chữ</span>)}{btn('Về vị trí gợi ý', () => { const src = fl.src; const w = fl.offsetWidth; fl.remove(); addFloat(src, fl.getAttribute('data-float') === 'stamp' ? stampWhere : 'TOP', w); }, <span className="text-[11px]">Vị trí gợi ý</span>)}{btn('Xóa ảnh nổi', () => { fl.remove(); pickFl(null); }, <Trash2 className="h-3.5 w-3.5" />)}</>}
      <span className="ml-auto px-1 text-[11px] text-[rgb(var(--muted))]">{fl ? 'Kéo ảnh, phím mũi tên để nhích (Shift: 10px)' : 'Kéo thả ảnh để di chuyển'}</span>
    </div>
  );
}

export function ComposerShell({ title, subtitle, badge, left, html, footer, onClose, wide, steps, outline, edit, print, share, notice }: {
  title: string; subtitle: string; badge?: ReactNode; left: ReactNode; html: string; footer: ReactNode; onClose: () => void; wide?: boolean; steps?: ComposerStep[]; outline?: boolean;
  /** Sửa trực tiếp trên bản xem trước: onSave nhận HTML đã sửa; customized = đang dùng bản sửa tay */
  edit?: { enabled: boolean; customized: boolean; onSave: (html: string) => void; onReset: () => void; /** v48: vị trí chèn con dấu & chữ ký */ kind?: 'QUOTE' | 'CONTRACT' };
  print?: PreviewAct; share?: { name: string; disabled?: boolean; title?: string }; notice?: ReactNode;
}) {
  const ov = useOverlay();
  const { company, go, canDo, notify } = useApp();
  const miss = missingCompanyInfo(company);
  const boxRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [fit, setFit] = useState(1);
  const [zoomPick, setZoomPick] = useSticky<number>('Composer.zoom', 0);
  const [editing, setEditing] = useState(false);
  const [frozen, setFrozen] = useState('');
  const [full, setFull] = useState(false);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // Trang A4 rộng 210mm ≈ 794px: "Vừa khung" thu nhỏ theo bề rộng khung xem trước
    const ro = new ResizeObserver(([e]) => setFit(Math.max(0.3, Math.min(1.2, (e.contentRect.width - 24) / 820))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === paneRef.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const zoom = zoomPick || fit;
  const step = (d: number) => setZoomPick(Math.round(Math.max(0.3, Math.min(2, zoom + d)) * 10) / 10);
  // Khi đang sửa trực tiếp: giữ nguyên nội dung khung để không mất chữ đang gõ
  const src = editing ? frozen : html;
  const doc = docShell('Xem trước', src).replace('</head>', `<style>@media screen{html{background:#cfd3da}body{zoom:${zoom.toFixed(3)}}${editing ? '.page{outline:2px dashed #f28c28;outline-offset:4px;width:210mm!important;max-width:none!important;padding:18mm 16mm!important;--pl:16mm!important;--pt:18mm!important}.page:focus{outline-style:solid}.page img{cursor:move}.page img:hover{outline:1px solid #f28c28}.page img[data-float]{cursor:grab;touch-action:none}.page img[data-float].on{outline:2px solid #2563eb;outline-offset:2px}' : ''}}</style></head>`);
  const onFrameLoad = () => {
    const d = frameRef.current?.contentDocument;
    const page = d?.querySelector('.page') as HTMLElement | null;
    if (page) page.contentEditable = editing ? 'true' : 'false';
    if (editing) page?.focus();
  };
  useEffect(onFrameLoad, [editing]);
  const startEdit = () => { setFrozen(html); setEditing(true); };
  const finishEdit = (keep: boolean) => {
    const page = frameRef.current?.contentDocument?.querySelector('.page') as HTMLElement | null;
    if (keep && page && edit) {
      page.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
      const out = page.innerHTML;
      if (out !== frozen) { edit.onSave(out); notify('Đã lưu nội dung sửa trực tiếp vào bản đang soạn', 'teal'); }
    }
    setEditing(false);
  };
  const toggleFull = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void paneRef.current?.requestFullscreen?.(); };
  const [sharing, setSharing] = useState(false);
  const doShare = async () => {
    if (!share || share.disabled || sharing) return;
    setSharing(true);
    let file: File;
    try {
      const blob = await docPdfBlob(share.name, html);
      file = new File([blob], `${share.name.replace(/[\\/:*?"<>|\s]+/g, '_')}.pdf`, { type: 'application/pdf' });
    } catch {
      setSharing(false);
      return notify('Không tạo được file PDF để chia sẻ', 'red');
    }
    setSharing(false);
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    // Bảng chia sẻ của hệ điều hành: Zalo, Messenger, Email… (điện thoại, Windows, macOS có hỗ trợ)
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try { await nav.share({ files: [file], title: share.name, text: share.name }); } catch { /* người dùng đóng bảng chia sẻ */ }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    notify('Trình duyệt này chưa hỗ trợ bảng chia sẻ: đã tải file PDF để gửi qua Zalo / email', 'orange');
  };
  const toc = useMemo(() => (outline ? docOutline(html) : []), [outline, html]);
  const [tocOn, setTocOn] = useState('');
  const jump = (key: string) => {
    setTocOn(key);
    const d = frameRef.current?.contentDocument;
    if (!d?.body) return;
    const re = new RegExp(`^\\s*${key.replace(' ', '\\s+')}(?!\\d)`);
    const el = Array.from(d.body.querySelectorAll('h1,h2,h3,h4,h5,p,b,strong,td,li,div')).find((e) => re.test(e.textContent ?? '') && !Array.from(e.children).some((c) => re.test(c.textContent ?? '')));
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  const firstOpen = steps ? steps.findIndex((s) => !s.done) : -1;
  const tb = 'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-[rgb(var(--fg2))] transition-colors hover:bg-[rgb(var(--ink)/0.06)] hover:text-[rgb(var(--fg))] disabled:pointer-events-none disabled:opacity-40';
  return (
    <div className={cn('fixed inset-0 z-50 flex flex-col bg-[rgb(var(--bg))] motion-safe:animate-[fadeIn_.15s_ease-out]', !ov.top && 'invisible')} aria-hidden={!ov.top || undefined} role="dialog" aria-modal="true" aria-label={title}>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-4 pt-[env(safe-area-inset-top)] sm:px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(var(--raised))]"><FileText className="h-4 w-4 text-[rgb(var(--fg2))]" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">{title}</p>
          <p className="truncate text-xs text-[rgb(var(--muted))]">{subtitle}</p>
        </div>
        {steps && (
          <ol className="hidden shrink-0 items-center gap-1 text-[13px] xl:flex" aria-label="Các bước">
            {steps.map((s, i) => {
              const on = i === (firstOpen < 0 ? steps.length - 1 : firstOpen);
              const act = s.onClick ?? (s.target ? () => document.getElementById(s.target!)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : undefined);
              return (
                <li key={s.label}>
                  <button type="button" disabled={!act} onClick={act} aria-current={on ? 'step' : undefined}
                    className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors disabled:cursor-default', on ? 'bg-[rgb(var(--raised))] font-medium text-[rgb(var(--fg))]' : s.done ? 'text-[rgb(var(--fg2))]' : 'text-[rgb(var(--muted))]', act && 'hover:text-[rgb(var(--fg))]')}>
                    {s.done ? <CheckCircle2 className="h-4 w-4 text-[rgb(var(--fg))]" aria-hidden /> : <span className={cn('flex h-[18px] w-[18px] items-center justify-center rounded-full border font-mono text-[11px]', on ? 'border-[rgb(var(--fg))]' : 'border-[rgb(var(--line))]')}>{i + 1}</span>}
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        {badge}
        <button className={cn(btnGhost, 'p-2')} onClick={onClose} aria-label="Đóng" title="Đóng"><X className="h-5 w-5" /></button>
      </header>
      <div className={cn('grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:overflow-hidden', wide ? 'lg:grid-cols-[64fr_36fr]' : 'lg:grid-cols-[52fr_48fr]')}>
        <div className="min-w-0 space-y-3 border-[rgb(var(--line))] p-4 lg:overflow-y-auto lg:border-r lg:px-5 [scrollbar-gutter:stable]">{left}</div>
        <div ref={paneRef} className="flex min-h-[75vh] min-w-0 flex-col bg-[rgb(var(--sunken))] lg:min-h-0">
          <div className="flex flex-wrap items-center gap-1 border-b border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-2 py-1.5" role="toolbar" aria-label="Thao tác xem trước">
            <button type="button" className={tb} onClick={() => step(-0.1)} aria-label="Thu nhỏ" title="Thu nhỏ"><Minus className="h-3.5 w-3.5" aria-hidden /></button>
            <button type="button" className={cn(tb, 'w-12 justify-center font-mono tabular-nums')} onClick={() => setZoomPick(zoomPick ? 0 : 1)} title={zoomPick ? 'Bấm để vừa khung' : 'Bấm để xem 100%'}>{Math.round(zoom * 100)}%</button>
            <button type="button" className={tb} onClick={() => step(0.1)} aria-label="Phóng to" title="Phóng to"><Plus className="h-3.5 w-3.5" aria-hidden /></button>
            <button type="button" className={cn(tb, !zoomPick && 'bg-[rgb(var(--ink)/0.06)] text-[rgb(var(--fg))]')} onClick={() => setZoomPick(0)} aria-pressed={!zoomPick}>Vừa khung</button>
            <span className="mx-1 h-4 w-px bg-[rgb(var(--line))]" aria-hidden />
            {edit?.enabled && (editing
              ? <><button type="button" className={cn(tb, 'bg-[rgb(var(--fg))] text-[rgb(var(--bg))] hover:bg-[rgb(var(--fg))] hover:text-[rgb(var(--bg))]')} onClick={() => finishEdit(true)}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />Xong</button><button type="button" className={tb} onClick={() => finishEdit(false)}>Bỏ sửa</button></>
              : <button type="button" className={tb} onClick={startEdit} title="Bấm vào chữ trên trang để sửa; nội dung sửa được lưu cùng phiên bản"><Pencil className="h-3.5 w-3.5" aria-hidden />Sửa trực tiếp</button>)}
            <span className="ml-auto" />
            <button type="button" className={tb} onClick={toggleFull} title={full ? 'Thoát toàn màn hình' : 'Toàn màn hình'}>{full ? <Minimize2 className="h-3.5 w-3.5" aria-hidden /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden />}<span className="hidden 2xl:inline">{full ? 'Thu lại' : 'Toàn màn hình'}</span></button>
            {print && <button type="button" aria-label="In" className={tb} onClick={print.onClick} disabled={print.disabled} title={print.title}><Printer className="h-3.5 w-3.5" aria-hidden /><span className="hidden 2xl:inline">In</span></button>}
            {share && <button type="button" className={tb} onClick={() => void doShare()} disabled={share.disabled || sharing} title={share.title ?? 'Chia sẻ file PDF qua Zalo, Messenger, Email… (bảng chia sẻ của máy)'}><Share2 className="h-3.5 w-3.5" aria-hidden />{sharing ? 'CRM 3A đang tạo PDF…' : 'Chia sẻ'}</button>}
          </div>
          {editing && <DocEditBar frame={frameRef} kind={edit?.kind} />}
          {!editing && edit?.customized && (
            <p className="flex flex-wrap items-center gap-2 border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] px-4 py-2 text-xs text-[rgb(var(--fg2))]" role="status">
              <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />Đang dùng nội dung sửa trực tiếp; số liệu đổi ở form không tự cập nhật vào trang
              {edit.enabled && <button type="button" className="font-medium text-[rgb(var(--fg))] hover:underline" onClick={edit.onReset}>Dựng lại từ form</button>}
            </p>
          )}
          {notice}
          {miss.length > 0 && (
            <p className="flex flex-wrap items-center gap-2 border-b border-[rgb(var(--accent)/0.3)] bg-[rgb(var(--accent)/0.08)] px-4 py-2 text-xs text-[rgb(var(--accent-fg))]" role="status">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />Bên bán còn thiếu {miss.join(', ')}: ô vàng sẽ in ra nếu xuất ngay.
              {canDo('settings.edit') && <button className="font-medium text-[rgb(var(--fg))] hover:underline" onClick={() => { onClose(); go('settings', 'company'); }}>Khai báo ở Cài đặt › Doanh nghiệp</button>}
            </p>
          )}
          <div className="flex min-h-0 flex-1">
            {toc.length >= 3 && (
              <nav className="hidden w-40 shrink-0 overflow-y-auto border-r border-[rgb(var(--line))] p-2 text-[12.5px] xl:block" aria-label="Mục lục hợp đồng">
                <p className="px-2 pb-2 pt-1 text-xs text-[rgb(var(--muted))]">Mục lục</p>
                {toc.map((t) => (
                  <button key={t.key} type="button" onClick={() => jump(t.key)} title={t.label}
                    className={cn('block w-full truncate rounded-md px-2 py-1.5 text-left', tocOn === t.key ? 'bg-[rgb(var(--surface))] font-medium text-[rgb(var(--fg))]' : 'text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.04)]')}>{t.label}</button>
                ))}
              </nav>
            )}
            <div ref={boxRef} className="min-h-0 min-w-0 flex-1">
              <iframe ref={frameRef} title="Xem trước tài liệu" className="h-full min-h-[70vh] w-full bg-[#cfd3da] lg:min-h-0" srcDoc={doc} onLoad={onFrameLoad} sandbox="allow-same-origin" />
            </div>
          </div>
        </div>
      </div>
      <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] sm:px-5">{footer}</footer>
    </div>
  );
}

/** Thanh hành động cố định của báo giá / hợp đồng: [Xuất PDF] [Tải Word] [Chốt đơn] [Gửi duyệt] */
export function DocActionBar({ status, extra, pdf, word, win, submit, totals }: { status: ReactNode; extra?: ReactNode; pdf: BarAct; word: BarAct; win: BarAct; submit: BarAct; totals?: ReactNode }) {
  const b = (a: BarAct, cls: string, Icon: typeof Wallet, label: string, primary?: boolean) => (
    <button className={cn(cls, 'justify-center sm:min-w-[96px]', primary && 'font-medium')} disabled={a.disabled} title={a.title} onClick={a.onClick}><Icon className="h-4 w-4" aria-hidden />{a.label ?? label}</button>
  );
  return (
    <>
      {totals}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-xs">{status}{extra}</div>
      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
        {b(pdf, btnGhost, Download, 'Xuất PDF')}
        {b(word, btnGhost, FileText, 'Tải Word')}
        {b(win, cn(btnBase, 'border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] px-3.5 py-2 font-medium text-[rgb(var(--fg))] hover:bg-[rgb(var(--ink)/0.04)] '), CheckCircle2, 'Chốt đơn')}
        {b(submit, btnPrimary, Send, 'Gửi duyệt', true)}
      </div>
    </>
  );
}

/** Nhóm gấp gọn trong form (giữ form ngắn, không phải cuộn dài) */
export function Fold({ n, title, summary, open, children }: { n?: number; title: string; summary?: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2.5 text-sm font-semibold">
        {n !== undefined && <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-[11px] font-semibold text-[rgb(var(--on-accent))]">{n}</span>}
        <span className={cn('shrink-0', n === undefined && 'text-xs font-medium text-[rgb(var(--muted))]')}>{title}</span>
        {summary && <span className="min-w-0 flex-1 truncate text-right text-xs font-normal text-[rgb(var(--muted))]">{summary}</span>}
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-[rgb(var(--muted))] transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-[rgb(var(--line))] p-3">{children}</div>
    </details>
  );
}

/** Bảng dòng hàng nhập bằng bàn phím: Tab đi qua SL → Giá → CK; Enter xuống dòng kế tiếp, dòng cuối nhảy tới ô thêm SKU */
export function useGridKeys() {
  const ref = useRef<HTMLDivElement>(null);
  const focusCell = (r: number, c = 0) => setTimeout(() => {
    const el = ref.current?.querySelector<HTMLInputElement>(`[data-r="${r}"][data-c="${c}"]`) ?? ref.current?.querySelector<HTMLInputElement>('[data-picker] input, [data-picker] select');
    el?.focus(); el?.select?.();
  }, 0);
  const onKeyDown = (e: RKeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (e.key !== 'Enter' || t.dataset.r === undefined) return;
    e.preventDefault();
    focusCell(Number(t.dataset.r) + 1, e.shiftKey ? Number(t.dataset.c) : 0);
  };
  return { ref, onKeyDown, focusCell };
}

/** Ô điều khoản dùng chung cho báo giá và hợp đồng */
export function TermsFields({ form, set, cTpl, contract, part = 'all', dense }: { form: ComposerForm; set: <K extends keyof ComposerForm>(k: K, v: ComposerForm[K]) => void; cTpl?: DocTemplate; contract: boolean; part?: 'all' | 'pay' | 'other'; dense?: boolean }) {
  const pay = part !== 'other';
  const other = part !== 'pay';
  return (
    <div className={cn('grid grid-cols-2 gap-3', dense && 'xl:grid-cols-4')}>
      {other && <Field label="Tiến độ / địa điểm giao hàng" className="col-span-2"><input className={inputCls} value={form.delivery} onChange={(e) => set('delivery', e.target.value)} /></Field>}
      {pay && <><Field label="Tạm ứng (%)"><input className={inputCls} type="number" min={0} max={100} value={form.advancePct} onChange={(e) => set('advancePct', Number(e.target.value))} /></Field>
      <Field label="Công nợ (ngày)" hint={contract ? `Chuẩn của mẫu: ${cTpl?.standardCreditDays ?? 0} ngày` : undefined}><input className={inputCls} type="number" min={0} value={form.creditDays} onChange={(e) => set('creditDays', Number(e.target.value))} /></Field></>}
      {pay && contract && (
        <>
          <Field label="Bảo lãnh">
            <select className={inputCls} value={form.guaranteeType} onChange={(e) => set('guaranteeType', e.target.value as GuaranteeType)}>
              {(Object.keys(GUARANTEE_LABEL) as GuaranteeType[]).map((g) => <option key={g} value={g}>{GUARANTEE_LABEL[g]}</option>)}
            </select>
          </Field>
          <Field label="Giá trị bảo lãnh (%)"><input className={inputCls} type="number" min={0} max={100} disabled={form.guaranteeType === 'NONE'} value={form.guaranteePct} onChange={(e) => set('guaranteePct', Number(e.target.value))} /></Field>
        </>
      )}
      {other && <Field label="Bảo hành (tháng)" hint="Để 0: in là bảo hành theo tiêu chuẩn nhà sản xuất"><input className={inputCls} type="number" min={0} value={form.warrantyMonths || ''} placeholder="Theo tiêu chuẩn nhà sản xuất" onChange={(e) => set('warrantyMonths', Math.max(0, Number(e.target.value) || 0))} /></Field>}
      {pay && !contract && <Field label="Hiệu lực báo giá (ngày)"><input className={inputCls} type="number" min={1} value={form.validDays} onChange={(e) => set('validDays', Number(e.target.value))} /></Field>}
      {pay && <Field label="Hình thức thanh toán" className={!contract ? undefined : 'col-span-2'}><input className={inputCls} value={form.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)} /></Field>}
      {other && <Field label="Ghi chú" className="col-span-2"><textarea className={cn(inputCls, 'min-h-16')} value={form.note} onChange={(e) => set('note', e.target.value)} /></Field>}
    </div>
  );
}

export function PartyFields({ form, setParty }: { form: ComposerForm; setParty: (k: keyof ComposerForm['party'], v: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      <Field label="Tên pháp nhân *" className="sm:col-span-2 lg:col-span-1 xl:col-span-2"><input className={inputCls} value={form.party.name} onChange={(e) => setParty('name', e.target.value)} /></Field>
      <Field label="Mã số thuế"><input className={inputCls} value={form.party.taxCode} onChange={(e) => setParty('taxCode', e.target.value)} /></Field>
      <Field label="Điện thoại"><input type="tel" autoComplete="tel" className={inputCls} inputMode="tel" value={form.party.phone} onChange={(e) => setParty('phone', e.target.value)} /></Field>
      <Field label="Địa chỉ" className="sm:col-span-2 lg:col-span-1 xl:col-span-2"><input className={inputCls} value={form.party.address} onChange={(e) => setParty('address', e.target.value)} /></Field>
      <Field label="Người đại diện"><input className={inputCls} value={form.party.rep} onChange={(e) => setParty('rep', e.target.value)} /></Field>
      <Field label="Chức vụ"><input className={inputCls} value={form.party.repTitle} onChange={(e) => setParty('repTitle', e.target.value)} /></Field>
    </div>
  );
}

