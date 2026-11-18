'use client';

import { type KeyboardEvent as RKeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Download, Eye, FileText, Send, Wallet, X } from 'lucide-react';
import { Field, useOverlay } from '../../components/ui';
import { btnBase, btnGhost, btnPrimary, compact, DOC_CSS, esc, GUARANTEE_LABEL, inputCls, missingCompanyInfo, money, RAW_VARS, REQUIRED_VARS, TX_CLAUSE, TX_TYPE, useApp, varLabel, VN_DIGITS } from '../../lib/core';
import type { BarAct, ComposerForm, Customer, DocContext, DocTemplate, GuaranteeType, SkuItem, TxType } from '../../lib/types';
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
  const today = new Date().toISOString().slice(0, 10);
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

export function docTotals(f: ComposerForm) {
  const sub = f.items.reduce((a, l) => a + l.qty * l.price, 0);
  const vat = Math.round((sub * f.vatPct) / 100);
  const grand = sub + vat;
  return { sub, vat, grand, advance: Math.round((grand * f.advancePct) / 100), guarantee: Math.round((grand * f.guaranteePct) / 100) };
}

/** v38.7: bảng hàng đầy đủ theo mẫu báo giá thiết bị vật tư (VAT từng dòng, hãng SX lấy từ danh mục sản phẩm) */
export function itemsTableFullHtml(f: ComposerForm, skus: SkuItem[] = []) {
  const t = docTotals(f);
  const n0 = (v: number) => Math.round(v).toLocaleString('vi-VN');
  const rows = f.items.map((l, i) => {
    const amount = l.qty * l.price, vat = Math.round((amount * f.vatPct) / 100);
    return `<tr><td class="c">${i + 1}</td><td class="c">${esc(l.sku)}</td><td>${esc(l.name)}</td><td class="c">${esc(skus.find((x) => x.sku === l.sku)?.brand ?? '')}</td><td class="c">${esc(l.unit)}</td><td class="c">${l.qty.toLocaleString('vi-VN')}</td><td class="r">${n0(l.price)}</td><td class="r">${n0(vat)}</td><td class="r">${n0(amount + vat)}</td><td>${l.discountPct ? `CK ${l.discountPct}%` : ''}</td></tr>`;
  }).join('');
  return `<table class="items items-full"><thead><tr><th>STT</th><th>MÃ HÀNG</th><th>HẠNG MỤC</th><th>HÃNG SX</th><th>ĐƠN VỊ</th><th>SỐ LƯỢNG</th><th>ĐƠN GIÁ</th><th>VAT ${f.vatPct}%</th><th>THÀNH TIỀN</th><th>GHI CHÚ</th></tr></thead><tbody>${rows || '<tr><td colspan="10" class="c">Chưa có hàng hóa</td></tr>'}
<tr class="total"><td colspan="7" class="c"><b>TỔNG TIỀN CÓ VAT</b></td><td class="r"><b>${n0(t.vat)}</b></td><td class="r"><b>${n0(t.grand)}</b></td><td class="c"><b>VND</b></td></tr></tbody></table>`;
}

export function itemsTableHtml(f: ComposerForm) {
  const t = docTotals(f);
  const rows = f.items.map((l, i) => `<tr><td class="c">${i + 1}</td><td>${esc(l.sku)}</td><td>${esc(l.name)}</td><td class="c">${esc(l.unit)}</td><td class="r">${l.qty.toLocaleString('vi-VN')}</td><td class="r">${Math.round(l.price).toLocaleString('vi-VN')}</td><td class="r">${Math.round(l.qty * l.price).toLocaleString('vi-VN')}</td></tr>`).join('');
  return `<table class="items"><thead><tr><th>STT</th><th>Mã hàng</th><th>Tên hàng hóa, quy cách</th><th>ĐVT</th><th>SL</th><th>Đơn giá (đ)</th><th>Thành tiền (đ)</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="c">Chưa có hàng hóa</td></tr>'}
<tr><td colspan="6" class="r">Cộng tiền hàng</td><td class="r">${t.sub.toLocaleString('vi-VN')}</td></tr>
<tr><td colspan="6" class="r">Thuế GTGT ${f.vatPct}%</td><td class="r">${t.vat.toLocaleString('vi-VN')}</td></tr>
<tr><td colspan="6" class="r"><b>Tổng cộng thanh toán</b></td><td class="r"><b>${t.grand.toLocaleString('vi-VN')}</b></td></tr></tbody></table>`;
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
    company_logo: x.company.logo ? `<img src="${x.company.logo}" alt="" style="height:48px;display:block;margin-bottom:6px">` : '',
    company_stamp: img(x.company.stamp),
    customer_name: f.party.name,
    tax_code: f.party.taxCode,
    customer_address: f.party.address,
    customer_rep: f.party.rep,
    customer_rep_title: f.party.repTitle,
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
    vat_rate: `${f.vatPct}%`,
    vat_amount: money(t.vat),
    grand_total: money(t.grand),
    grand_total_words: moneyToWordsVN(t.grand),
    delivery_terms: f.delivery,
    advance_percent: `${f.advancePct}%`,
    advance_amount: money(t.advance),
    guarantee_terms: f.guaranteeType === 'NONE' ? '' : `Bên B nộp cho Bên A ${GUARANTEE_LABEL[f.guaranteeType].toLowerCase()} trị giá ${f.guaranteePct}% giá trị hợp đồng (${money(t.guarantee)}) do ngân hàng hoạt động hợp pháp tại Việt Nam phát hành.`,
    warranty_months: String(f.warrantyMonths),
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

/** Khung chung Split-View cố định: trái 38% form tối giản, phải 62% bản A4 xem trước theo thời gian thực;
 *  thanh nút hành động cố định dưới đáy. Hai cột cuộn độc lập, không cuộn dài cả trang. */
export function ComposerShell({ title, subtitle, badge, left, html, footer, onClose, wide }: { title: string; subtitle: string; badge?: ReactNode; left: ReactNode; html: string; footer: ReactNode; onClose: () => void; wide?: boolean }) {
  const ov = useOverlay();
  const { company, go, canDo } = useApp();
  const miss = missingCompanyInfo(company);
  const boxRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // Trang A4 rộng 210mm ≈ 794px: thu nhỏ vừa khung xem trước, không phóng to quá 100%
    const ro = new ResizeObserver(([e]) => setZoom(Math.max(0.4, Math.min(1, (e.contentRect.width - 24) / 820))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const doc = docShell('Xem trước', html).replace('</head>', `<style>@media screen{html{background:#cfd3da}body{zoom:${zoom.toFixed(3)}}}</style></head>`);
  return (
    <div className={cn('fixed inset-0 z-50 flex flex-col bg-[rgb(var(--bg))] motion-safe:animate-[fadeIn_.15s_ease-out]', !ov.top && 'invisible')} aria-hidden={!ov.top || undefined} role="dialog" aria-modal="true" aria-label={title}>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[rgb(var(--line))] px-4 pt-[env(safe-area-inset-top)] sm:px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded bg-[rgb(var(--accent)/0.15)]"><FileText className="h-4 w-4 text-[rgb(var(--accent))]" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-xs text-[rgb(var(--muted))]">{subtitle}</p>
        </div>
        {badge}
        <button className={cn(btnGhost, 'p-2')} onClick={onClose} aria-label="Đóng" title="Đóng"><X className="h-5 w-5" /></button>
      </header>
      <div className={cn('grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:overflow-hidden', wide ? 'lg:grid-cols-[64fr_36fr]' : 'lg:grid-cols-[38fr_62fr]')}>
        <div className="min-w-0 space-y-4 border-[rgb(var(--line))] p-4 lg:overflow-y-auto lg:border-r [scrollbar-gutter:stable]">{left}</div>
        <div className="flex min-h-[75vh] min-w-0 flex-col bg-[rgb(var(--sunken))] lg:min-h-0">
          <p className="flex items-center gap-2 border-b border-[rgb(var(--line))] px-4 py-2 text-xs text-[rgb(var(--muted))]"><Eye className="h-3.5 w-3.5" aria-hidden />Xem trước khổ A4, cập nhật theo từng thao tác. Ô vàng là biến chưa có dữ liệu.<span className="ml-auto tabular-nums">{Math.round(zoom * 100)}%</span></p>
          {miss.length > 0 && (
            <p className="flex flex-wrap items-center gap-2 border-b border-[rgb(var(--accent)/0.3)] bg-[rgb(var(--accent)/0.1)] px-4 py-2 text-xs text-[rgb(var(--accent-fg))]" role="status">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />Thông tin bên bán ({company.legalName || company.shortName}) còn thiếu {miss.join(', ')}: các ô vàng sẽ in ra nếu xuất ngay.
              {canDo('settings.edit') && <button className="font-semibold text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => { onClose(); go('settings'); }}>Khai báo ở Cài đặt › Doanh nghiệp</button>}
            </p>
          )}
          <div ref={boxRef} className="min-h-0 flex-1">
            <iframe title="Xem trước tài liệu" className="h-full min-h-[70vh] w-full bg-[#cfd3da] lg:min-h-0" srcDoc={doc} sandbox="allow-same-origin" />
          </div>
        </div>
      </div>
      <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[rgb(var(--line))] bg-[rgb(var(--sunken))] px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] sm:px-5">{footer}</footer>
    </div>
  );
}

/** Thanh hành động cố định của báo giá / hợp đồng: [Xuất PDF] [Tải Word] [Chốt đơn] [Gửi duyệt] */
export function DocActionBar({ status, extra, pdf, word, win, submit }: { status: ReactNode; extra?: ReactNode; pdf: BarAct; word: BarAct; win: BarAct; submit: BarAct }) {
  const b = (a: BarAct, cls: string, Icon: typeof Wallet, label: string, primary?: boolean) => (
    <button className={cn(cls, 'min-w-[112px] justify-center', primary && 'shadow-[0_0_0_1px_rgba(255,140,0,.35)]')} disabled={a.disabled} title={a.title} onClick={a.onClick}><Icon className="h-4 w-4" aria-hidden />{a.label ?? label}</button>
  );
  return (
    <>
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
export function TermsFields({ form, set, cTpl, contract, part = 'all' }: { form: ComposerForm; set: <K extends keyof ComposerForm>(k: K, v: ComposerForm[K]) => void; cTpl?: DocTemplate; contract: boolean; part?: 'all' | 'pay' | 'other' }) {
  const pay = part !== 'other';
  const other = part !== 'pay';
  return (
    <div className="grid grid-cols-2 gap-3">
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
      {other && <Field label="Bảo hành (tháng)"><input className={inputCls} type="number" min={0} value={form.warrantyMonths} onChange={(e) => set('warrantyMonths', Number(e.target.value))} /></Field>}
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

