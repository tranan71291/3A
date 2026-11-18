'use client';

import { useState } from 'react';
import { Download, Send } from 'lucide-react';
import { Field, Modal } from '../components/ui';
import { blockersOf, btnGhost, btnPrimary, compact, EMAIL_PRESET, EMAIL_RE, esc, inputCls, isQuoteOverdue, LOST_REASON, pct, useApp } from './core';
import type { CompanyInfo, LostReason, ReportData } from './types';

export function buildReportHtml(d: ReportData, company: CompanyInfo): string {
  const kpi = (label: string, value: string, sub: string, color: string) =>
    `<td width="50%" style="padding:6px"><div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:14px">
      <div style="font-size:12px;color:#64748b">${esc(label)}</div>
      <div style="font-size:24px;font-weight:700;color:${color};margin-top:4px">${esc(value)}</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px">${esc(sub)}</div></div></td>`;
  const row = (k: string, v: string, warn = false) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #eef0f3;color:#475569;font-size:13px">${esc(k)}</td><td align="right" style="padding:8px 0;border-bottom:1px solid #eef0f3;font-size:13px;font-weight:600;color:${warn ? '#dc2626' : '#0f172a'}">${esc(v)}</td></tr>`;
  const vnd0 = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫';
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Báo cáo ${esc(d.monthLabel)}</title></head>
<body style="margin:0;background:#f1f3f6;font-family:'Be Vietnam Pro',Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f3f6;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
  <tr><td style="background:#0F141E;border-radius:12px 12px 0 0;padding:22px 24px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>${company.logo ? `<td style="padding-right:10px"><img src="${company.logo}" alt="" width="36" height="36" style="display:block;border-radius:6px;background:#fff"></td>` : ''}<td style="font-size:13px;color:#F28C33;font-weight:600;letter-spacing:.2px">${esc(company.appName)}, ${esc(company.legalName)}</td></tr></table>
    <div style="font-size:22px;color:#F1F5F9;font-weight:700;margin-top:4px">Báo cáo vận hành ${esc(d.monthLabel)}</div>
    <div style="font-size:13px;color:#94A3B8;margin-top:4px">Lead Marketing, bán hàng, Getfly và quỹ MDF ${esc(d.vendor)}</div>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:12px 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>${kpi('Lead nhận 30 ngày', String(d.leads30), 'Từ các kênh Marketing', '#0f172a')}${kpi('Tiếp nhận đúng SLA 2 giờ', d.slaRate, d.slaDetail, '#00a383')}</tr>
      <tr>${kpi('Chốt đơn / Trượt', `${d.won} / ${d.lost}`, `Tỷ lệ chốt ${d.winRate}`, '#00a383')}${kpi('Doanh số Getfly lũy kế', compact(d.gfYtd), `Trong tháng ${compact(d.gfMonth)}`, '#0f172a')}</tr>
    </table>
  </td></tr>
  <tr><td style="background:#ffffff;padding:20px 24px">
    <div style="font-size:15px;font-weight:700">Tiến độ giải ngân quỹ MDF</div>
    <div style="margin-top:10px;background:#eef0f3;border-radius:6px;height:12px;overflow:hidden;font-size:0">
      <span style="display:inline-block;height:12px;width:${d.mdfSpentPct.toFixed(1)}%;background:#F28C33"></span><span style="display:inline-block;height:12px;width:${d.mdfCommitPct.toFixed(1)}%;background:#F9C25A"></span>
    </div>
    <div style="font-size:12px;color:#64748b;margin-top:6px">Đã tiêu ${vnd0(d.mdfSpent)} / ${vnd0(d.mdfTotal)} (${d.mdfSpentPct.toFixed(1)}%), đang giữ chỗ ${d.mdfCommitPct.toFixed(1)}%</div>
    <div style="font-size:15px;font-weight:700;margin-top:22px">Việc cần xử lý</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px">
      ${row('Dự án quá hạn nộp báo giá 24 giờ', String(d.quoteOverdue), d.quoteOverdue > 0)}
      ${row('Hồ sơ claim còn thiếu chứng từ', String(d.claimsBlocked), d.claimsBlocked > 0)}
      ${row('Claim đã nộp, chờ Hãng hoàn quỹ', String(d.claimsPending))}
      ${row('Lý do trượt nhiều nhất', d.topLost)}
    </table>
    <div style="margin-top:22px"><a href="#" style="display:inline-block;background:#F28C33;color:#0F141E;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px">Mở bảng điều khiển</a></div>
  </td></tr>
  <tr><td style="background:#0F141E;border-radius:0 0 12px 12px;padding:14px 24px;font-size:11px;color:#94A3B8">
    Email tự động gửi ngày đầu tháng tới Ban Giám đốc, Marketing và Kế toán. Số liệu Getfly cập nhật qua webhook và đồng bộ hằng đêm.
  </td></tr>
</table></td></tr></table></body></html>`;
}

export function MonthlyReportModal({ onClose }: { onClose: () => void }) {
  const { myLeads: leads, getflyOrders, budget, claims, policy, emailCfg, addMsgLog, notify, now, company } = useApp();
  const [to, setTo] = useState(emailCfg.reportRecipients.split(',')[0]?.trim() ?? '');
  const [sending, setSending] = useState(false);
  const d = new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const slaDone = leads.filter((l) => l.slaMet !== undefined);
  const met = slaDone.filter((l) => l.slaMet).length;
  const won = leads.filter((l) => l.status === 'WON').length;
  const lost = leads.filter((l) => l.status === 'LOST');
  const top = (Object.keys(LOST_REASON) as LostReason[]).map((r) => ({ r, n: lost.filter((l) => l.lostReason === r).length })).sort((a, b) => b.n - a.n)[0];
  const approved = getflyOrders.filter((o) => o.approved);
  const data: ReportData = {
    monthLabel: `tháng ${d.getMonth() + 1}/${d.getFullYear()}`,
    vendor: budget.vendor,
    leads30: leads.filter((l) => l.receivedDaysAgo <= 30).length,
    slaRate: pct(met, slaDone.length),
    slaDetail: `${met}/${slaDone.length} lead đã tiếp nhận`,
    won,
    lost: lost.length,
    winRate: pct(won, won + lost.length),
    topLost: top && top.n ? `${LOST_REASON[top.r]} (${top.n})` : 'Chưa có',
    gfMonth: approved.filter((o) => o.orderDate.startsWith(ym)).reduce((s, o) => s + o.net, 0),
    gfYtd: approved.filter((o) => o.orderDate.startsWith(String(budget.fiscalYear))).reduce((s, o) => s + o.net, 0),
    mdfSpentPct: budget.total ? (budget.spent / budget.total) * 100 : 0,
    mdfCommitPct: budget.total ? (budget.committed / budget.total) * 100 : 0,
    mdfSpent: budget.spent,
    mdfTotal: budget.total,
    quoteOverdue: leads.filter((l) => isQuoteOverdue(l, now)).length,
    claimsBlocked: claims.filter((c) => !c.submitted && blockersOf(c, policy.rules) > 0).length,
    claimsPending: claims.filter((c) => c.submitted && !c.creditNote).length,
  };
  const html = buildReportHtml(data, company);
  const subject = `[${company.appName}] Báo cáo vận hành ${data.monthLabel}`;

  const send = async () => {
    if (!EMAIL_RE.test(to.trim())) return notify('Email người nhận chưa đúng định dạng', 'red');
    if (!emailCfg.enabled) return notify('Kênh Email đang tắt (Cài đặt > Email SMTP)', 'red');
    setSending(true);
    await new Promise((r) => setTimeout(r, 900));
    const ok = !!emailCfg.password && !!emailCfg.host;
    addMsgLog({ channel: 'EMAIL', to: to.trim(), subject, ok, detail: ok ? `Gửi qua ${EMAIL_PRESET[emailCfg.provider].label} (${emailCfg.host}:${emailCfg.port}) từ ${emailCfg.fromEmail}` : 'Xác thực SMTP thất bại: thiếu máy chủ hoặc mật khẩu' });
    notify(ok ? `Đã gửi thử email báo cáo tới ${to.trim()}` : 'Gửi thất bại: kiểm tra cấu hình SMTP', ok ? 'teal' : 'red');
    setSending(false);
  };
  const downloadHtml = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    a.download = `bao_cao_${ym}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <Modal
      title="Xem trước Email Báo cáo Tháng"
      onClose={onClose}
      wide
      footer={
        <>
          <button className={btnGhost} onClick={downloadHtml}><Download className="h-4 w-4" aria-hidden />Tải HTML</button>
          <button className={btnPrimary} disabled={sending} onClick={send}><Send className="h-4 w-4" aria-hidden />{sending ? 'Đang gửi...' : 'Gửi thử nghiệm'}</button>
        </>
      }
    >
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Gửi thử tới"><input className={inputCls} type="email" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <div className="text-xs text-[rgb(var(--muted))]">
          <p className="mb-1.5 font-medium">Tiêu đề</p>
          <p className="text-sm text-[rgb(var(--fg))]">{subject}</p>
          <p className="mt-1">Từ: {emailCfg.fromName} &lt;{emailCfg.fromEmail}&gt;</p>
        </div>
      </div>
      <iframe title="Mẫu email báo cáo tháng" srcDoc={html} sandbox="" className="h-[560px] w-full rounded border border-[rgb(var(--line))] bg-white" />
    </Modal>
  );
}

