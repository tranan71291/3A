'use client';

import { Field, Panel, Table } from '../../components/ui';
import { CHANNEL_LABEL, EVENT_LABEL, inputCls, rowCls, tdCls, tdFirst, tdLast, useApp } from '../../lib/core';
import type { Channel, NotifyEvent, ZnsTemplateKey } from '../../lib/types';
import { Switch } from '../platform/console';
import { MsgLogList } from './email';

/** Thông báo hệ thống qua ZNS: bật kênh, chọn mẫu ZNS (đã khai báo ở trên) cho từng sự kiện, kênh gửi theo sự kiện, nhật ký */
export function ZnsSettings() {
  const { zns, setZns, notifyRules, setNotifyRules, canDo, hubCfg } = useApp();
  const canEdit = canDo('settings.edit');
  const tpls = hubCfg.zalo.znsTemplates;
  const toggleRule = (ev: NotifyEvent, ch: Channel) =>
    setNotifyRules((p) => ({ ...p, [ev]: p[ev].includes(ch) ? p[ev].filter((x) => x !== ch) : [...p[ev], ch] }));
  return (
    <div className="space-y-5">
      <Panel title="Thông báo hệ thống" action={<label className="flex items-center gap-2 text-sm">Gửi qua Zalo ZNS<Switch on={zns.enabled} disabled={!canEdit} onChange={(v) => setZns((z) => ({ ...z, enabled: v }))} label="Bật thông báo ZNS" /></label>}>
        <p className="mb-3 text-sm text-[rgb(var(--muted))]">Nhân sự nhận thông báo ZNS khi có sự kiện bên dưới. Chọn mẫu đã khai báo ở mục Mẫu tin ZNS; kết nối Zalo dùng chung cấu hình máy chủ ở trên.</p>
        <div className="grid gap-3 md:grid-cols-3">
          {(Object.keys(zns.templates) as ZnsTemplateKey[]).map((k) => (
            <Field key={k} label={EVENT_LABEL[k]}>
              <select className={inputCls} disabled={!canEdit} value={zns.templates[k]} onChange={(ev) => setZns((z) => ({ ...z, templates: { ...z.templates, [k]: ev.target.value } }))}>
                <option value="">Không gửi</option>
                {tpls.map((t) => <option key={t.id} value={t.templateId}>{t.name} ({t.templateId})</option>)}
              </select>
            </Field>
          ))}
        </div>
      </Panel>
      <Panel title="Kênh gửi theo sự kiện">
        <Table stack={false} head={['Sự kiện', ...(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => CHANNEL_LABEL[c])]} minW={560}>
          {(Object.keys(EVENT_LABEL) as NotifyEvent[]).map((ev) => (
            <tr key={ev} className={rowCls}>
              <td className={tdFirst}>{EVENT_LABEL[ev]}</td>
              {(Object.keys(CHANNEL_LABEL) as Channel[]).map((ch, i, arr) => (
                <td key={ch} className={i === arr.length - 1 ? tdLast : tdCls}>
                  <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" disabled={!canEdit || (ev === 'MONTHLY_REPORT' && ch !== 'EMAIL')} checked={notifyRules[ev].includes(ch)} onChange={() => toggleRule(ev, ch)} aria-label={`${EVENT_LABEL[ev]} qua ${CHANNEL_LABEL[ch]}`} />
                </td>
              ))}
            </tr>
          ))}
        </Table>
      </Panel>
      <Panel title="Nhật ký gửi Zalo ZNS"><MsgLogList channel="ZNS" /></Panel>
    </div>
  );
}

