'use client';

import { CheckCircle2, Mail, Send, XCircle } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, Field, Panel, SetBlock, SideCard } from '../../components/ui';
import { btnGhost, EMAIL_PRESET, EMAIL_RE, inputCls, useApp } from '../../lib/core';
import type { EmailConfig, EmailProvider } from '../../lib/types';
import { cn } from '../../lib/utils';
import { Switch } from '../platform/console';
import { SaveBar } from './company';

// =====================================================================
//  CÀI ĐẶT: EMAIL SMTP
// =====================================================================

export function MsgLogList({ channel }: { channel: 'EMAIL' | 'ZNS' }) {
  const { msgLogs } = useApp();
  const list = msgLogs.filter((m) => m.channel === channel).slice(0, 20);
  if (!list.length) return <EmptyState text={<>Chưa có tin nào được gửi.</>} art="inbox" compact />;
  return (
    <ul className="divide-y divide-[rgb(var(--line))]">
      {list.map((m) => (
        <li key={m.id} className="flex items-start gap-3 py-2.5 text-sm">
          {m.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--success))]" aria-hidden /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--danger))]" aria-hidden />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[rgb(var(--fg))]">{m.subject}</p>
            <p className="break-words text-xs text-[rgb(var(--muted))]">Tới {m.to}. {m.detail}</p>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-[rgb(var(--muted))]">{new Date(m.at).toLocaleTimeString('vi-VN')}</span>
        </li>
      ))}
    </ul>
  );
}

export function EmailSettings() {
  const { emailCfg, setEmailCfg, canDo, notify, addMsgLog, company } = useApp();
  const canEdit = canDo('settings.edit');
  const [f, setF] = useState(emailCfg);
  const [show, setShow] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof EmailConfig>(k: K, v: EmailConfig[K]) => setF((p) => ({ ...p, [k]: v }));
  const recipients = f.reportRecipients.split(',').map((x) => x.trim()).filter(Boolean);
  const e: Partial<Record<keyof EmailConfig, string>> = {};
  if (!f.host.trim()) e.host = 'Nhập máy chủ SMTP';
  if (!(f.port > 0 && f.port < 65536)) e.port = 'Cổng không hợp lệ';
  if (!EMAIL_RE.test(f.fromEmail)) e.fromEmail = 'Email gửi chưa đúng';
  if (f.replyTo && !EMAIL_RE.test(f.replyTo)) e.replyTo = 'Email trả lời chưa đúng';
  if (recipients.some((r) => !EMAIL_RE.test(r))) e.reportRecipients = 'Có email người nhận sai định dạng';
  const err = (k: keyof EmailConfig) => (touched ? e[k] : undefined);

  const pickProvider = (p: EmailProvider) => {
    const pr = EMAIL_PRESET[p];
    setF((x) => ({ ...x, provider: p, host: pr.host || x.host, port: pr.port, secure: pr.secure, username: pr.username || x.username }));
  };
  const save = () => {
    setTouched(true);
    if (Object.keys(e).length) return;
    setEmailCfg(f);
    notify('Đã lưu cấu hình Email. Mật khẩu / API Key được mã hóa khi lưu ở backend.', 'teal');
  };
  const test = async () => {
    if (!EMAIL_RE.test(testTo)) return notify('Nhập email nhận thử hợp lệ', 'red');
    await new Promise((r) => setTimeout(r, 700));
    const ok = emailCfg.enabled && !!emailCfg.password;
    addMsgLog({ channel: 'EMAIL', to: testTo, subject: `[${company.appName}] Email kiểm tra cấu hình`, ok, detail: ok ? `Kết nối ${emailCfg.host}:${emailCfg.port} ${emailCfg.secure ? 'SSL/TLS' : 'STARTTLS'} thành công` : !emailCfg.enabled ? 'Kênh Email đang tắt' : 'Xác thực SMTP thất bại, kiểm tra mật khẩu / API Key' });
    notify(ok ? `Đã gửi email kiểm tra tới ${testTo}` : 'Gửi thất bại, xem nhật ký', ok ? 'teal' : 'red');
  };

  const dirty = canEdit && JSON.stringify(f) !== JSON.stringify(emailCfg);
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
      <Panel title="Máy chủ gửi email" action={<span className="flex items-center gap-2 text-[13px] text-[rgb(var(--fg2))]">Bật kênh email<Switch on={f.enabled} disabled={!canEdit} onChange={(v) => set('enabled', v)} label="Bật kênh email" /></span>}>
        <div className="mb-2 flex w-fit flex-wrap gap-0.5 rounded-lg bg-[rgb(var(--raised))] p-0.5" role="radiogroup" aria-label="Nhà cung cấp">
          {(Object.keys(EMAIL_PRESET) as EmailProvider[]).map((p) => (
            <button key={p} role="radio" aria-checked={f.provider === p} disabled={!canEdit} onClick={() => pickProvider(p)} className={cn('rounded-md px-3 py-1.5 text-[13px] transition-colors disabled:opacity-50', f.provider === p ? 'bg-[rgb(var(--surface))] font-medium text-[rgb(var(--fg))] shadow-sm' : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')}>
              {EMAIL_PRESET[p].label}
            </button>
          ))}
        </div>
        <p className="mb-4 text-xs text-[rgb(var(--muted))]">{EMAIL_PRESET[f.provider].hint}</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Máy chủ SMTP" error={err('host')} className="md:col-span-2"><input className={inputCls} disabled={!canEdit} value={f.host} onChange={(ev) => set('host', ev.target.value.trim())} /></Field>
          <Field label="Cổng" error={err('port')}><input className={inputCls} type="number" disabled={!canEdit} value={f.port} onChange={(ev) => set('port', Number(ev.target.value))} /></Field>
          <Field label="Tên đăng nhập"><input className={inputCls} disabled={!canEdit} value={f.username} onChange={(ev) => set('username', ev.target.value.trim())} /></Field>
          <Field label="Mật khẩu / API Key" className="md:col-span-2">
            <div className="flex gap-2">
              <input className={inputCls} disabled={!canEdit} type={show ? 'text' : 'password'} autoComplete="off" value={f.password} onChange={(ev) => set('password', ev.target.value)} />
              <button type="button" className={cn(btnGhost, 'shrink-0')} onClick={() => setShow((v) => !v)}>{show ? 'Ẩn' : 'Hiện'}</button>
            </div>
          </Field>
          <Field label="Tên người gửi"><input className={inputCls} disabled={!canEdit} value={f.fromName} onChange={(ev) => set('fromName', ev.target.value)} /></Field>
          <Field label="Email người gửi" error={err('fromEmail')}><input type="email" autoComplete="email" spellCheck={false} className={inputCls} disabled={!canEdit} value={f.fromEmail} onChange={(ev) => set('fromEmail', ev.target.value.trim())} /></Field>
          <Field label="Email trả lời" error={err('replyTo')}><input className={inputCls} disabled={!canEdit} value={f.replyTo} onChange={(ev) => set('replyTo', ev.target.value.trim())} /></Field>
          <label className="flex items-center gap-2 text-sm md:col-span-3"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" disabled={!canEdit} checked={f.secure} onChange={(ev) => set('secure', ev.target.checked)} />Kết nối SSL/TLS trực tiếp (cổng 465). Bỏ chọn để dùng STARTTLS (cổng 587).</label>
        </div>
      </Panel>

      <SetBlock title="Nhật ký gửi"><MsgLogList channel="EMAIL" /></SetBlock>
        {dirty && <SaveBar onCancel={() => setF(emailCfg)} onSave={save} />}
      </div>
      <div className="min-w-0 space-y-4">
        <SideCard title="Email báo cáo tháng" icon={Mail}>
        <div className="grid grid-cols-1 gap-3">
          <Field label="Người nhận (cách nhau bởi dấu phẩy)" error={err('reportRecipients')}><input className={inputCls} disabled={!canEdit} value={f.reportRecipients} onChange={(ev) => set('reportRecipients', ev.target.value)} /></Field>
          <Field label="Gửi vào ngày trong tháng" hint="Lúc 08:00 giờ Việt Nam"><input className={inputCls} type="number" min={1} max={28} disabled={!canEdit} value={f.reportDay} onChange={(ev) => set('reportDay', Math.min(28, Math.max(1, Number(ev.target.value))))} /></Field>
        </div>
        </SideCard>
        <SideCard title="Gửi thử" icon={Send}>
          <p className="mb-2 text-xs text-[rgb(var(--muted))]">Kiểm tra cấu hình đã lưu bằng một email thử</p>
          <div className="flex gap-2"><input className={inputCls} value={testTo} onChange={(ev) => setTestTo(ev.target.value.trim())} placeholder="ten@congty.vn" aria-label="Gửi email kiểm tra tới" /><button className={cn(btnGhost, 'shrink-0')} onClick={test}><Send className="h-4 w-4" aria-hidden />Gửi</button></div>
        </SideCard>
      </div>
    </div>
  );
}

