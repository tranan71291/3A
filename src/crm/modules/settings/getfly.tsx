'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, Plug, RefreshCw, XCircle } from 'lucide-react';
import { Chip, EmptyState, Field, MoneyInput, Panel, Table } from '../../components/ui';
import { btnGhost, btnPrimary, compact, FIELD_MAP, HOOK_LABEL, inputCls, rowCls, tdCls, tdFirst, tdLast, todayISO, useApp } from '../../lib/core';
import { financialsFromOrders } from '../../lib/getfly';
import type { GetflyConfig, HookEvent } from '../../lib/types';
import { cn } from '../../lib/utils';

export function GetflySettings() {
  const { getfly, setGetfly, getflyOrders, setGetflyOrders, customers, getflyLogs, addGetflyLog, recomputeLinked, canDo, role, notify, budget } = useApp();
  const canEdit = canDo('settings.edit');
  const canRun = canEdit || role === 'MKT_LEAD';
  const [f, setF] = useState<GetflyConfig>(getfly);
  const [touched, setTouched] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState<'test' | 'sync' | 'hook' | null>(null);
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);

  const linked = customers.filter((c) => c.getflyAccountId);
  const [hookCustomer, setHookCustomer] = useState(linked[0]?.id ?? '');
  const [hookEvent, setHookEvent] = useState<HookEvent>('order.created');
  const [hookOrder, setHookOrder] = useState('');
  const [hookAmount, setHookAmount] = useState(150_000_000);
  const [hookToken, setHookToken] = useState(getfly.webhookSecret);
  const [resend, setResend] = useState(false);
  const [lastUid, setLastUid] = useState('');
  const [processed, setProcessed] = useState<string[]>([]);

  const e: Partial<Record<keyof GetflyConfig, string>> = {};
  // Chế độ mô phỏng: cho phép lưu khi chưa có thông tin kết nối thật
  if (!f.demoMode) {
    if (!/^https:\/\/[^\s/]+\.[^\s/]+/.test(f.baseUrl)) e.baseUrl = 'Dạng https://tencongty.getflycrm.com';
    if (!/^[A-Za-z0-9]{20,64}$/.test(f.apiKey)) e.apiKey = 'API Key gồm 20–64 ký tự chữ và số (Getfly cấp 30 ký tự)';
    if (f.webhookSecret.length < 24) e.webhookSecret = 'Tối thiểu 24 ký tự';
  }
  if (!/^[a-z0-9_]{2,64}$/.test(f.taxCodeField)) e.taxCodeField = 'Chữ thường, số, dấu _';
  const err = (k: keyof GetflyConfig) => (touched ? e[k] : undefined);
  const dirty = JSON.stringify({ ...f, lastTest: undefined, lastFullSyncAt: undefined }) !== JSON.stringify({ ...getfly, lastTest: undefined, lastFullSyncAt: undefined });
  const webhookUrl = `${origin || 'https://app-cua-ban.vn'}/api/webhooks/getfly?token=${encodeURIComponent(getfly.webhookSecret)}`;
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const save = () => {
    setTouched(true);
    if (Object.keys(e).length) return;
    setGetfly((p) => ({ ...f, baseUrl: f.baseUrl.replace(/\/+$/, ''), lastTest: p.lastTest, lastFullSyncAt: p.lastFullSyncAt }));
    setHookToken(f.webhookSecret);
    notify('Đã lưu cấu hình Getfly. API Key và Secret được mã hóa khi lưu ở backend.', 'teal');
  };

  const genSecret = () => {
    const a = new Uint8Array(24);
    crypto.getRandomValues(a);
    const s = 'whsec_' + btoa(String.fromCharCode(...a)).replace(/[+/=]/g, '').slice(0, 32);
    setF((p) => ({ ...p, webhookSecret: s }));
  };

  /** Mô phỏng testGetflyConnection: GET /api/v3/accounts?limit=1 */
  const test = async () => {
    setBusy('test');
    const t0 = Date.now();
    await delay(600 + Math.random() * 500);
    const ms = Date.now() - t0;
    let ok = true;
    let message: string;
    if (!/^https:\/\/.+/.test(f.baseUrl)) { ok = false; message = 'Base URL không hợp lệ'; }
    else if (!/^[A-Za-z0-9]{30}$/.test(f.apiKey)) { ok = false; message = 'API Key không hợp lệ hoặc không đủ quyền (HTTP 401)'; }
    else {
      const host = f.baseUrl.replace(/^https:\/\//, '').replace(/\/.*$/, '');
      message = `Kết nối thành công tới ${host} (${ms} ms)${host.endsWith('.getflycrm.com') ? '' : '. Lưu ý: tên miền không thuộc getflycrm.com'}`;
    }
    setGetfly((p) => ({ ...p, lastTest: { at: Date.now(), ok, message } }));
    addGetflyLog({ direction: 'OUT', title: 'Kiểm tra kết nối', ok, detail: message });
    notify(message, ok ? 'teal' : 'red');
    setBusy(null);
  };

  /** Mô phỏng syncAllRevenueFromGetfly: kéo đơn bán trong kỳ, tính lại doanh số, công nợ, ROI */
  const fullSync = async () => {
    if (!getfly.isActive) return notify('Kết nối Getfly đang tắt', 'red');
    setBusy('sync');
    await delay(1200);
    const counted = getflyOrders.filter((o) => o.approved && linked.some((c) => c.id === o.customerId));
    recomputeLinked(getflyOrders);
    setGetfly((p) => ({ ...p, lastFullSyncAt: Date.now() }));
    const msg = `${counted.length} đơn đã duyệt / ${linked.length} khách hàng liên kết. Đã tính lại doanh số lũy kế, công nợ và MDF ROI.`;
    addGetflyLog({ direction: 'IN', title: 'Đồng bộ toàn bộ doanh số', ok: true, detail: msg });
    notify(msg, 'teal');
    setBusy(null);
  };

  /** Mô phỏng route /api/webhooks/getfly: token -> uid chống trùng -> đọc đơn -> tính lại */
  const sendHook = async () => {
    setBusy('hook');
    await delay(500);
    const uid = resend && lastUid ? lastUid : crypto.randomUUID();
    const cust = customers.find((c) => c.id === hookCustomer);
    const log = (ok: boolean, detail: string) => addGetflyLog({ direction: 'IN', title: `Webhook ${hookEvent}`, ok, detail: `uid ${uid.slice(0, 8)}: ${detail}` });
    try {
      if (!getfly.isActive) return log(false, 'HTTP 503, kết nối đang tắt');
      if (hookToken !== getfly.webhookSecret) return log(false, 'HTTP 401, token không khớp Webhook Secret');
      if (processed.includes(uid)) return log(true, 'HTTP 200, uid đã xử lý trước đó nên bỏ qua (chống trùng)');
      if (!cust) return log(false, 'Không tìm thấy khách hàng khớp account_id / MST / SĐT, đã bỏ qua');

      let next = getflyOrders;
      let detail = '';
      if (hookEvent === 'order.created') {
        if (hookAmount <= 0) return log(false, 'Giá trị đơn phải lớn hơn 0');
        const id = Math.max(18300, ...getflyOrders.map((o) => o.orderId)) + 1;
        const vat = Math.round((hookAmount * getfly.defaultVatPct) / 100);
        next = [{ orderId: id, orderCode: `DH${id}`, customerId: cust.id, orderDate: todayISO(), net: hookAmount, vat, gross: hookAmount + vat, paid: 0, approved: false, source: 'GETFLY', lines: 1 }, ...getflyOrders];
        detail = `Nhận đơn DH${id} (${compact(hookAmount + vat)}) của ${cust.name}, chờ duyệt nên chưa tính doanh số`;
      } else {
        const o = getflyOrders.find((x) => x.orderCode === hookOrder && x.customerId === cust.id);
        if (!o) return log(false, 'Chọn đơn hàng cần cập nhật');
        if (hookEvent === 'order.approved') {
          next = getflyOrders.map((x) => (x.orderCode === o.orderCode ? { ...x, approved: true } : x));
          detail = `Đơn ${o.orderCode} đã duyệt, cộng ${compact(o.net)} doanh số ròng cho ${cust.name}`;
        } else {
          const pay = Math.min(hookAmount, o.gross - o.paid);
          if (pay <= 0) return log(false, `Đơn ${o.orderCode} đã thanh toán đủ`);
          next = getflyOrders.map((x) => (x.orderCode === o.orderCode ? { ...x, paid: x.paid + pay } : x));
          detail = `Đơn ${o.orderCode} ghi nhận thanh toán ${compact(pay)}, giảm công nợ ${cust.name}`;
        }
      }
      setGetflyOrders(next);
      recomputeLinked(next, [cust.id]);
      const fin = financialsFromOrders(cust.id, next, budget.fiscalYear);
      log(true, `${detail}. Doanh số Getfly năm ${compact(fin.ytd)}, công nợ ${compact(fin.debt)}`);
      notify(detail, 'teal');
    } finally {
      setProcessed((p) => (p.includes(uid) ? p : [...p, uid]));
      setLastUid(uid);
      setBusy(null);
    }
  };

  const custOrders = getflyOrders.filter((o) => o.customerId === hookCustomer);
  const orderOptions = hookEvent === 'order.approved' ? custOrders.filter((o) => !o.approved) : custOrders.filter((o) => o.approved && o.paid < o.gross);

  return (
    <div className="space-y-5">
      <Panel
        title="Thông tin kết nối Getfly API v3"
        action={getfly.lastTest && <Chip tone={getfly.lastTest.ok ? 'teal' : 'red'}>{getfly.lastTest.ok ? 'Kết nối tốt' : 'Lỗi kết nối'}, {new Date(getfly.lastTest.at).toLocaleTimeString('vi-VN')}</Chip>}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Getfly Base URL (Domain)" error={err('baseUrl')} hint="VD: https://tencongty.getflycrm.com">
            <input className={inputCls} disabled={!canEdit} value={f.baseUrl} onChange={(ev) => setF({ ...f, baseUrl: ev.target.value.trim() })} placeholder="https://tencongty.getflycrm.com" />
          </Field>
          <Field label="Getfly API Key" error={err('apiKey')} hint="Getfly > Cài đặt > Tích hợp > Tích hợp phần mềm khác > Getfly API Key">
            <div className="flex gap-2">
              <input className={inputCls} disabled={!canEdit} type={showKey ? 'text' : 'password'} autoComplete="off" value={f.apiKey} onChange={(ev) => setF({ ...f, apiKey: ev.target.value.trim() })} />
              <button type="button" className={cn(btnGhost, 'shrink-0')} onClick={() => setShowKey((v) => !v)}>{showKey ? 'Ẩn' : 'Hiện'}</button>
            </div>
          </Field>
          <Field label="Webhook Secret Token" error={err('webhookSecret')} hint="Gắn vào URL webhook, dùng để xác thực sự kiện từ Getfly">
            <div className="flex gap-2">
              <input className={inputCls} disabled={!canEdit} type={showSecret ? 'text' : 'password'} autoComplete="off" value={f.webhookSecret} onChange={(ev) => setF({ ...f, webhookSecret: ev.target.value.trim() })} />
              <button type="button" className={cn(btnGhost, 'shrink-0')} onClick={() => setShowSecret((v) => !v)}>{showSecret ? 'Ẩn' : 'Hiện'}</button>
              <button type="button" className={cn(btnGhost, 'shrink-0')} disabled={!canEdit} onClick={genSecret}>Tạo mới</button>
            </div>
          </Field>
          <Field label="Mã trường Mã số thuế trên Getfly" error={err('taxCodeField')} hint="Getfly không có trường MST mặc định: tạo trường này ở Định nghĩa dữ liệu khách hàng">
            <input className={inputCls} disabled={!canEdit} value={f.taxCodeField} onChange={(ev) => setF({ ...f, taxCodeField: ev.target.value.trim() })} />
          </Field>
          <Field label="VAT mặc định cho dòng BOQ (%)">
            <input className={inputCls} disabled={!canEdit} type="number" min={0} max={20} value={f.defaultVatPct} onChange={(ev) => setF({ ...f, defaultVatPct: Number(ev.target.value) })} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-[rgb(var(--fg))]">
            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" disabled={!canEdit} checked={f.isActive} onChange={(ev) => setF({ ...f, isActive: ev.target.checked })} />
            Bật đồng bộ 2 chiều với Getfly
          </label>
          <label className="flex items-start gap-2 text-sm md:col-span-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]" disabled={!canEdit} checked={!!f.demoMode} onChange={(ev) => setF({ ...f, demoMode: ev.target.checked })} />
            <span>Chế độ mô phỏng<span className="block text-xs text-[rgb(var(--muted))]">Không gọi Getfly thật; tạo đơn giả lập để thử luồng báo giá → chốt đơn → đơn hàng. Tắt khi đã có API Key thật.</span></span>
          </label>
        </div>
        {getfly.lastTest && <p className={cn('mt-3 text-sm', getfly.lastTest.ok ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--danger-fg))]')}>{getfly.lastTest.message}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={btnPrimary} disabled={!canEdit || !dirty} onClick={save}>Lưu cấu hình</button>
          <button className={btnGhost} disabled={!canRun || busy !== null} onClick={test}>
            <Plug className="h-4 w-4" aria-hidden />{busy === 'test' ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
          </button>
          <button className={btnGhost} disabled={!canRun || busy !== null || dirty} title={dirty ? 'Lưu cấu hình trước khi đồng bộ' : undefined} onClick={fullSync}>
            <RefreshCw className={cn('h-4 w-4', busy === 'sync' && 'motion-safe:animate-spin')} aria-hidden />{busy === 'sync' ? 'Đang đồng bộ…' : 'Đồng bộ toàn bộ doanh số thủ công'}
          </button>
        </div>
        {getfly.lastFullSyncAt && <p className="mt-2 text-xs text-[rgb(var(--muted))]">Đồng bộ toàn bộ gần nhất: {new Date(getfly.lastFullSyncAt).toLocaleString('vi-VN')}</p>}
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Khai báo webhook trên Getfly">
          <p className="text-sm text-[rgb(var(--muted))]">Vào Getfly &gt; Cài đặt &gt; Tích hợp &gt; Webhook, dán URL dưới đây và bật các sự kiện đơn hàng.</p>
          <div className="mt-3 flex gap-2">
            <input className={cn(inputCls, 'font-mono text-xs')} readOnly value={canEdit ? webhookUrl : webhookUrl.replace(/token=.*/, 'token=••••••')} aria-label="URL webhook" />
            <button className={cn(btnGhost, 'shrink-0')} disabled={!canEdit} onClick={() => navigator.clipboard?.writeText(webhookUrl).then(() => notify('Đã sao chép URL webhook', 'teal'), () => notify('Trình duyệt chặn sao chép', 'red'))}>
              <Copy className="h-4 w-4" aria-hidden />Sao chép
            </button>
          </div>
          <ul className="mt-4 space-y-1.5 text-sm">
            {(['Tạo đơn hàng mới', 'Duyệt đơn hàng', 'Sửa đơn hàng'] as const).map((t) => <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[rgb(var(--success))]" aria-hidden />{t}</li>)}
          </ul>
          <p className="mt-4 rounded bg-[rgb(var(--accent)/0.1)] p-3 text-xs text-[rgb(var(--accent-fg))]">
            Webhook Getfly không có sự kiện riêng cho thanh toán công nợ. Công nợ được cập nhật khi đơn được sửa / duyệt (hệ thống đọc lại payments của đơn) và qua nút Đồng bộ toàn bộ. Nên đặt thêm cron đồng bộ hằng đêm.
          </p>
        </Panel>

        <Panel title="Giả lập sự kiện webhook (bản demo)">
          {linked.length === 0 ? (
            <p className="text-sm text-[rgb(var(--muted))]">Chưa có khách hàng liên kết Getfly.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Khách hàng (khớp theo account_id / MST / SĐT)">
                <select className={inputCls} value={hookCustomer} onChange={(ev) => { setHookCustomer(ev.target.value); setHookOrder(''); }}>
                  {linked.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.getflyAccountCode})</option>)}
                </select>
              </Field>
              <Field label="Sự kiện">
                <select className={inputCls} value={hookEvent} onChange={(ev) => { setHookEvent(ev.target.value as HookEvent); setHookOrder(''); }}>
                  {(Object.keys(HOOK_LABEL) as HookEvent[]).map((k) => <option key={k} value={k}>{HOOK_LABEL[k]}</option>)}
                </select>
              </Field>
              {hookEvent !== 'order.created' && (
                <Field label="Đơn hàng" className="sm:col-span-2">
                  <select className={inputCls} value={hookOrder} onChange={(ev) => setHookOrder(ev.target.value)}>
                    <option value="">{orderOptions.length ? 'Chọn đơn' : hookEvent === 'order.approved' ? 'Không có đơn chờ duyệt' : 'Không có đơn còn nợ'}</option>
                    {orderOptions.map((o) => <option key={o.orderCode} value={o.orderCode}>{o.orderCode}, {compact(o.gross)}, còn nợ {compact(o.gross - o.paid)}</option>)}
                  </select>
                </Field>
              )}
              {hookEvent !== 'order.approved' && (
                <Field label={hookEvent === 'order.created' ? 'Giá trị đơn chưa VAT' : 'Số tiền khách thanh toán'}><MoneyInput value={hookAmount} onChange={setHookAmount} /></Field>
              )}
              <Field label="Token trong URL" hint="Sửa để thử trường hợp token sai">
                <input className={cn(inputCls, 'font-mono text-xs')} value={hookToken} onChange={(ev) => setHookToken(ev.target.value)} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-[rgb(var(--fg))] sm:col-span-2">
                <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={resend} disabled={!lastUid} onChange={(ev) => setResend(ev.target.checked)} />
                Gửi lại uid của sự kiện trước (thử chống xử lý trùng)
              </label>
              <button className={cn(btnPrimary, 'sm:col-span-2')} disabled={busy !== null} onClick={sendHook}>{busy === 'hook' ? 'Đang gửi…' : 'Gửi sự kiện tới /api/webhooks/getfly'}</button>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Ánh xạ trường dữ liệu App MDF và Getfly">
        <Table head={['Nhóm', 'App MDF', 'Getfly API v3']} minW={640}>
          {FIELD_MAP.map(([g, a, b]) => (
            <tr key={g + a} className={rowCls}>
              <td className={cn(tdFirst, 'text-[rgb(var(--muted))]')}>{g}</td>
              <td className={tdCls}>{a}</td>
              <td className={cn(tdLast, 'font-mono text-xs text-[rgb(var(--secondary-fg))]')}>{b.replace('ma_so_thue', getfly.taxCodeField)}</td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Panel title={`Nhật ký đồng bộ (${getflyLogs.length})`}>
        {getflyLogs.length === 0 ? (
          <EmptyState text={<>Chưa có hoạt động</>} hint={<>Chốt một dự án, kiểm tra kết nối hoặc gửi webhook giả lập để xem nhật ký.</>} art="box" compact />
        ) : (
          <ul className="divide-y divide-[rgb(var(--line))]">
            {getflyLogs.slice(0, 30).map((l) => (
              <li key={l.id} className="flex items-start gap-3 py-2.5 text-sm">
                {l.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--success))]" aria-hidden /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--danger))]" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <p className="text-[rgb(var(--fg))]"><Chip tone={l.direction === 'OUT' ? 'orange' : 'blue'}>{l.direction === 'OUT' ? 'App → Getfly' : 'Getfly → App'}</Chip> <span className="ml-1">{l.title}</span></p>
                  <p className="mt-0.5 break-words text-xs text-[rgb(var(--muted))]">{l.detail}</p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-[rgb(var(--muted))]">{new Date(l.at).toLocaleTimeString('vi-VN')}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

