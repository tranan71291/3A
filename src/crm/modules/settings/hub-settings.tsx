'use client';

import { useState } from 'react';
import { Copy, MessageCircle, Plus, RefreshCw, Send, Trash2, X, Zap } from 'lucide-react';
import { Field, MoneyInput, Panel, RuleRow, SideCard, Tabs, useSticky } from '../../components/ui';
import { AI_NAME, btnGhost, btnSm, DEALER_BONUS_TEMPLATE, inputBase, inputCls, SOCIAL0, uid, useApp, ZNS_SOURCES } from '../../lib/core';
import type { AiProviderPref, HubCfg, KbItem, KbRule, SocialCfg, ZnsTpl } from '../../lib/types';
import { cn } from '../../lib/utils';
import { useAi, useServerStatus } from '../ai/ai-core';
import { GhostSettingsPanel, VariantSettingsPanel } from '../marketing/content-workspace';
import { Switch } from '../platform/console';
import { ZnsSettings } from './zns';

// =====================================================================
//  CÀI ĐẶT AI & ZALO (v32): nhà cung cấp AI, Zalo OA, mẫu ZNS, bản tin điều hành, kiến thức cho AI
// =====================================================================

export function HubSettings({ part = 'ai', znsOn = true }: { part?: 'ai' | 'zalo'; znsOn?: boolean } = {}) {
  const app = useApp();
  const subs: { id: string; label: string }[] = part === 'ai'
    ? [{ id: 'assist', label: 'Trợ lý AI' }, { id: 'ghost', label: 'Gợi ý viết' }, { id: 'variant', label: 'Biến thể nội dung' }, { id: 'kb', label: 'Kiến thức cho AI' }, { id: 'media', label: 'Bản tin & truyền thông' }]
    : [{ id: 'oa', label: 'Kết nối OA' }, { id: 'zns', label: 'Mẫu ZNS' }, ...(znsOn ? [{ id: 'notify', label: 'Thông báo & nhật ký' }] : [])];
  const [sub0, setSub] = useSticky<string>(`HubSettings.${part}`, subs[0].id);
  const sub = subs.some((x) => x.id === sub0) ? sub0 : subs[0].id;
  const { hubCfg, setHubCfg, kb, setKb, canDo, org, notify, audit, me, company } = app;
  const [srv, recheck] = useServerStatus();
  const soc = { ...SOCIAL0, ...(hubCfg.social ?? {}) };
  const setSoc = (p: Partial<SocialCfg>) => setHubCfg((c) => ({ ...c, social: { ...SOCIAL0, ...(c.social ?? {}), ...p } }));
  const ai = useAi('copilot');
  const ro = !canDo('settings.edit');
  const [test, setTest] = useState('');
  const [busy, setBusy] = useState(false);
  const setAi = (p: Partial<HubCfg['ai']>) => setHubCfg((c) => ({ ...c, ai: { ...c.ai, ...p } }));
  const setZ = (p: Partial<HubCfg['zalo']>) => setHubCfg((c) => ({ ...c, zalo: { ...c.zalo, ...p } }));
  const origin = typeof location !== 'undefined' ? location.origin : '';
  const hook = `${origin}/api/zalo/webhook?tenant=${org.id}`;
  const dot = (on: boolean, label: string, hint: string) => (
    <li className="flex items-start gap-2.5 rounded-md border border-[rgb(var(--line))] px-3 py-2.5">
      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', on ? 'bg-[rgb(var(--success))]' : 'bg-[rgb(var(--line))]')} aria-hidden />
      <span className="min-w-0"><b className="text-sm font-medium">{label}</b><span className={cn('ml-2 text-xs', on ? 'text-[rgb(var(--success))]' : 'text-[rgb(var(--muted))]')}>{on ? 'Đã cấu hình' : 'Chưa cấu hình'}</span><span className="block text-[11px] text-[rgb(var(--muted))]">{hint}</span></span>
    </li>
  );
  const runTest = async () => { setBusy(true); const t0 = Date.now(); const r = await ai.ask({ prompt: 'Trả lời đúng một câu: "Kết nối AI thành công" kèm tên mô hình của bạn.', maxTokens: 60 }); setBusy(false); setTest(r.ok ? `${AI_NAME[r.provider]} · ${r.model} · ${((Date.now() - t0) / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giây: ${r.text}` : `Lỗi: ${r.error === 'offline' ? 'AI chưa sẵn sàng (chưa bật hoặc máy chủ chưa có khóa)' : r.error}`); };
  const ZT: ZnsTpl = { id: '', name: '', templateId: '', params: [] };
  return (
    <div className="space-y-5">
      <Tabs tabs={subs} value={sub} onChange={setSub} />
      {sub === 'assist' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {([[srv.ai.anthropic, 'Claude (Anthropic)', srv.models.anthropic || 'mặc định', 'ANTHROPIC_API_KEY'], [srv.ai.openai, 'OpenAI', srv.models.openai || 'mặc định', 'OPENAI_API_KEY'], [srv.images, 'Tạo ảnh (OpenAI Images)', srv.models.image || 'gpt-image-1', 'OPENAI_API_KEY']] as const).map(([on, name, model, env]) => (
            <div key={name} className="glass-card rounded-xl px-4 py-3" title={`Biến môi trường ${env}`}>
              <p className="flex items-start gap-2 text-[13.5px] font-medium"><span className="flex-1">{name}</span><span className={cn('flex items-center gap-1.5 text-xs font-normal', on ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--muted))]')}><span className={cn('h-1.5 w-1.5 rounded-full', on ? 'bg-[rgb(var(--success))]' : 'bg-[rgb(var(--ink)/0.25)]')} aria-hidden />{on ? 'Đã kết nối' : 'Chưa cấu hình'}</span></p>
              <p className="mt-0.5 truncate font-mono text-xs text-[rgb(var(--muted))]">{model}</p>
            </div>
          ))}
        </div>
      )}
      {sub === 'media' && <Panel title="Kết nối máy chủ" action={<button className={cn(btnGhost, btnSm)} onClick={recheck}><RefreshCw className="h-3.5 w-3.5" aria-hidden />Kiểm tra lại</button>}>
        <ul className="grid gap-2 md:grid-cols-2">
          {dot(!!srv.social?.facebook, 'Facebook Fanpage (bài mới trên Bàn làm việc)', 'FACEBOOK_PAGE_ACCESS_TOKEN (Page access token), FACEBOOK_PAGE_ID tùy chọn')}
          {dot(srv.images, 'Tạo ảnh minh họa (OpenAI Images)', `Dùng OPENAI_API_KEY · mô hình ${srv.models.image || 'gpt-image-1'} (OPENAI_IMAGE_MODEL). Claude không tạo ảnh`)}
        </ul>
      </Panel>}

      <fieldset disabled={ro} className="space-y-5">
        {sub === 'assist' && <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
          <div className="min-w-0 space-y-4">
            <Panel title="Nhà cung cấp" action={<button type="button" className={cn(btnGhost, btnSm)} onClick={recheck}><RefreshCw className="h-3.5 w-3.5" aria-hidden />Kiểm tra lại</button>}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Nhà cung cấp"><select className={inputCls} value={hubCfg.ai.provider} onChange={(e) => setAi({ provider: e.target.value as AiProviderPref })}><option value="AUTO">Tự động (ưu tiên Claude)</option><option value="ANTHROPIC">Claude (Anthropic)</option><option value="OPENAI">OpenAI</option></select></Field>
                <Field label="Mô hình Claude"><input className={inputCls} value={hubCfg.ai.anthropicModel} onChange={(e) => setAi({ anthropicModel: e.target.value.trim() })} placeholder={srv.models.anthropic || 'mặc định'} /></Field>
                <Field label="Mô hình OpenAI"><input className={inputCls} value={hubCfg.ai.openaiModel} onChange={(e) => setAi({ openaiModel: e.target.value.trim() })} placeholder={srv.models.openai || 'mặc định'} /></Field>
              </div>
              <div className="mt-3"><p className="text-xs text-[rgb(var(--muted))]">Khóa API đặt trong biến môi trường của máy chủ (Vercel &gt; Settings &gt; Environment Variables hoặc file .env.local), không lưu trong dữ liệu CRM và không gửi về trình duyệt. {srv.checked && !srv.reachable && <b className="text-[rgb(var(--accent-fg))]">Không gọi được route /api trên máy chủ: app đang chạy dạng tĩnh nên dùng chế độ mô phỏng.</b>}</p></div>
            </Panel>
            <Panel title="Tính năng" action={<span className="flex items-center gap-2 text-[13px] text-[rgb(var(--fg2))]">Bật trợ lý<Switch on={hubCfg.ai.enabled} onChange={(v) => setAi({ enabled: v })} label="Bật trợ lý AI" disabled={ro} /></span>}>
              <div className={cn('grid gap-x-8 sm:grid-cols-2', !hubCfg.ai.enabled && 'opacity-50')}>
              {([['copilot', 'AI Copilot (cột phải, ô tìm kiếm)'], ['chat', '@AI trong chat & gợi ý trả lời Zalo'], ['visual', 'Tìm kiếm bằng hình ảnh'], ['writer', 'Soạn thảo nội dung, banner'], ['image', 'Tạo ảnh minh họa (OpenAI Images)'], ['extract', 'Bóc tách ảnh / PDF vào báo giá'], ['brief', 'Bản tin điều hành BOD']] as const).map(([k, l]) => (
                <label key={k} className="flex items-center justify-between gap-3 border-b border-[rgb(var(--ink)/0.06)] py-2.5 text-[13px] last:border-0">{l}<Switch on={hubCfg.ai.features[k]} onChange={(v) => setAi({ features: { ...hubCfg.ai.features, [k]: v } })} label={l} disabled={ro} /></label>
              ))}
              </div>
              {!hubCfg.ai.enabled && <p className="mt-2 text-xs text-[rgb(var(--muted))]">Đang tắt: Copilot chỉ dùng bộ phân tích cục bộ, không gửi dữ liệu ra ngoài.</p>}
            </Panel>
            <Panel title="An toàn dữ liệu">
              <ul className="-mt-2 divide-y divide-[rgb(var(--ink)/0.06)]">
                <li className="flex items-center gap-3 py-2.5"><div className="min-w-0 flex-1"><p className="text-[13px] font-medium">Che số điện thoại, email</p><p className="text-xs text-[rgb(var(--muted))]">trước khi gửi cho nhà cung cấp AI</p></div><Switch on={hubCfg.ai.maskPii} onChange={(v) => setAi({ maskPii: v })} label="Che số điện thoại, email" disabled={ro} /></li>
                <RuleRow title="Khóa API chỉ ở máy chủ" detail="không lưu trong dữ liệu CRM, không gửi về trình duyệt" />
              </ul>
            </Panel>
          </div>
          <div className="min-w-0 space-y-4">
            <SideCard title="Thử kết nối">
              <p className="mb-3 text-xs text-[rgb(var(--muted))]">Gửi một câu hỏi mẫu, đo thời gian phản hồi</p>
              <button type="button" className={cn(btnGhost, btnSm)} onClick={() => void runTest()} disabled={busy}><Zap className="h-3.5 w-3.5" aria-hidden />{busy ? 'Đang thử…' : 'Thử ngay'}</button>
              {test && <p className="mt-3 text-xs text-[rgb(var(--fg2))]">{test}</p>}
            </SideCard>
          </div>
        </div>}

        {sub === 'ghost' && <GhostSettingsPanel />}

        {sub === 'variant' && <VariantSettingsPanel />}

        {sub === 'media' && <><Panel title="Bản tin điều hành mỗi sáng">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2"><Switch on={hubCfg.brief.enabled} onChange={(v) => setHubCfg((c) => ({ ...c, brief: { ...c.brief, enabled: v } }))} label="Tự tạo bản tin" disabled={ro} />Tự tạo khi Giám đốc mở Bàn làm việc</label>
            <label className="flex items-center gap-2">từ<select className={cn(inputBase, 'h-9 py-0')} value={hubCfg.brief.hour} onChange={(e) => setHubCfg((c) => ({ ...c, brief: { ...c.brief, hour: Number(e.target.value) } }))}>{[5, 6, 7, 8, 9, 10].map((h) => <option key={h} value={h}>{h}:00</option>)}</select>sáng</label>
          </div>
        </Panel>

        <Panel title="Truyền thông đa kênh trên Bàn làm việc">
          <p className="mb-3 text-sm text-[rgb(var(--muted))]">Widget hiển thị bài mới nhất từ Fanpage, Zalo OA và YouTube để nhân viên sao chép liên kết, chia sẻ cho khách bằng 1 chạm. Bài Marketing thêm tay (nút + trên widget) luôn hiển thị, kể cả khi chưa kết nối API.</p>
          <fieldset disabled={ro} className="grid gap-3 sm:grid-cols-2">
            <Field label="Tên khối" className="sm:col-span-2"><input className={inputCls} value={soc.title} placeholder={`Truyền thông ${company.shortName || company.appName} & 3A Group`} onChange={(e) => setSoc({ title: e.target.value })} /></Field>
            <Field label="Địa chỉ Fanpage"><input className={inputCls} value={soc.facebookUrl} placeholder="https://www.facebook.com/…" onChange={(e) => setSoc({ facebookUrl: e.target.value.trim() })} /></Field>
            <Field label="Facebook Page ID" hint="Tự lấy bài mới cần FACEBOOK_PAGE_ACCESS_TOKEN trên máy chủ"><input className={inputCls} value={soc.facebookPageId} onChange={(e) => setSoc({ facebookPageId: e.target.value.trim() })} /></Field>
            <Field label="Địa chỉ Zalo OA" hint="Tin bài OA lấy bằng kết nối Zalo OA ở trên"><input className={inputCls} value={soc.zaloOaUrl} placeholder="https://zalo.me/…" onChange={(e) => setSoc({ zaloOaUrl: e.target.value.trim() })} /></Field>
            <Field label="Địa chỉ kênh YouTube"><input className={inputCls} value={soc.youtubeUrl} placeholder="https://www.youtube.com/@…" onChange={(e) => setSoc({ youtubeUrl: e.target.value.trim() })} /></Field>
            <Field label="YouTube Channel ID" hint="Dạng UC…, xem ở youtube.com/account_advanced. Không cần khóa API" className="sm:col-span-2"><input className={inputCls} value={soc.youtubeChannelId} placeholder="UCxxxxxxxxxxxxxxxxxxxxxx" onChange={(e) => setSoc({ youtubeChannelId: e.target.value.trim() })} /></Field>
          </fieldset>
        </Panel></>}

        {sub === 'oa' && <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
          <div className="min-w-0 space-y-4">
            <Panel title="Zalo Official Account" action={<span className={cn('flex items-center gap-1.5 text-xs', srv.zalo.oa ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--muted))]')}><span className={cn('h-1.5 w-1.5 rounded-full', srv.zalo.oa ? 'bg-[rgb(var(--success))]' : 'bg-[rgb(var(--ink)/0.25)]')} aria-hidden />{srv.zalo.oa ? 'Đã kết nối' : 'Chưa kết nối'}</span>}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Tên Zalo OA"><input className={inputCls} value={hubCfg.zalo.oaName} onChange={(e) => setZ({ oaName: e.target.value })} placeholder="VD: VASSH - Vật tư điện" /></Field>
              <Field label="OA ID"><input className={inputCls} value={hubCfg.zalo.oaId} onChange={(e) => setZ({ oaId: e.target.value.trim() })} /></Field>
              <Field label="Cảnh báo chờ phản hồi sau (phút)"><input type="number" min={1} className={inputCls} value={hubCfg.zalo.replyMinutes} onChange={(e) => setZ({ replyMinutes: Math.max(1, Number(e.target.value) || 15) })} /></Field>
            </div>
              <div className="mt-3 flex items-center gap-2"><code className="min-w-0 flex-1 truncate rounded-lg border border-[rgb(var(--line))] px-3 py-2 font-mono text-xs">{hook}</code><button type="button" className={cn(btnGhost, btnSm, 'shrink-0')} onClick={() => { void navigator.clipboard?.writeText(hook).then(() => notify('Đã sao chép URL webhook', 'teal')); }}><Copy className="h-3.5 w-3.5" aria-hidden />Sao chép</button></div>
              <p className="mt-1.5 text-xs text-[rgb(var(--muted))]">Khai báo trên Zalo for Developers, mục Webhook. Nhận tin tự động: {srv.zalo.webhook ? 'đã cấu hình' : 'chưa cấu hình (ZALO_OA_SECRET_KEY + ZALO_INGEST_TOKEN)'}. Mỗi doanh nghiệp dùng OA riêng bằng hậu tố biến môi trường, ví dụ ZALO_OA_ACCESS_TOKEN__{org.id.toUpperCase()}.</p>
            </Panel>
            <Panel title="Phân công hội thoại">
              <div className="-mt-2">
            <label className="flex items-center justify-between gap-3 border-b border-[rgb(var(--ink)/0.06)] py-2.5 text-[13px] last:border-0"><span><b className="font-medium">Tự liên kết hội thoại</b><span className="block text-xs text-[rgb(var(--muted))]">Khi trùng số điện thoại, mã đơn / mã khách, hoặc trùng tên và địa chỉ (VD: “Cô Nga ở Khâm Thiên”)</span></span><Switch on={hubCfg.zalo.autoLink} onChange={(v) => setZ({ autoLink: v })} label="Tự liên kết" disabled={ro} /></label>
            <label className="flex items-center justify-between gap-3 border-b border-[rgb(var(--ink)/0.06)] py-2.5 text-[13px] last:border-0"><span><b className="font-medium">Nhân viên xem mọi hội thoại</b><span className="block text-xs text-[rgb(var(--muted))]">Tắt: nhân viên chỉ thấy hội thoại được giao và hội thoại chưa ai nhận (bảo mật khách hàng)</span></span><Switch on={hubCfg.zalo.salesSeeAll} onChange={(v) => { setZ({ salesSeeAll: v }); audit('ZALO_CONFIG', `Nhân viên xem mọi hội thoại: ${v ? 'bật' : 'tắt'}`, 'SECURITY'); }} label="Nhân viên xem mọi hội thoại" disabled={ro} /></label>
              </div>
            </Panel>
          </div>
          <div className="min-w-0 space-y-4">
            <SideCard title="Mẫu trả lời nhanh" icon={MessageCircle}>
              <p className="mb-2 text-xs text-[rgb(var(--muted))]">AI gợi ý câu trả lời theo hội thoại, dùng các mẫu này làm giọng văn</p>
            <Field label="Mỗi dòng một mẫu; biến {ten} {nhanvien} {congty} {ma}"><textarea className={cn(inputCls, 'min-h-[140px] text-[13px]')} defaultValue={hubCfg.zalo.quickReplies.join('\n')} onBlur={(e) => setZ({ quickReplies: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} /></Field>
            </SideCard>
            <SideCard title="Mẫu ZNS" icon={Send}>
              <p className="mb-2 text-xs text-[rgb(var(--muted))]">{hubCfg.zalo.znsTemplates.length ? `${hubCfg.zalo.znsTemplates.length} mẫu đã khai báo` : 'Chưa có mẫu'}. Mẫu phải được Zalo duyệt trước, nhập Template ID để dùng.</p>
              <button type="button" className={cn(btnGhost, btnSm)} onClick={() => setSub('zns')}><Plus className="h-3.5 w-3.5" aria-hidden />Mẫu ZNS</button>
            </SideCard>
          </div>
        </div>}

        {sub === 'zns' && <Panel title="Mẫu tin ZNS" action={!ro && <button type="button" className={cn(btnGhost, btnSm)} onClick={() => setZ({ znsTemplates: [...hubCfg.zalo.znsTemplates, { ...ZT, id: uid('zt'), name: 'Mẫu mới', params: [{ key: 'customer_name', source: 'customer.name' }] }] })}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm mẫu</button>}>
          <p className="mb-3 text-xs text-[rgb(var(--muted))]">Mẫu ZNS phải được Zalo duyệt trước. Nhập Template ID và tên tham số đúng như mẫu đã duyệt, chọn nguồn dữ liệu để CRM tự điền.</p>
          <ul className="space-y-3">
            {hubCfg.zalo.znsTemplates.map((t, i) => {
              const upd = (p: Partial<ZnsTpl>) => setZ({ znsTemplates: hubCfg.zalo.znsTemplates.map((x, k) => (k === i ? { ...x, ...p } : x)) });
              return (
                <li key={t.id} className="rounded-md border border-[rgb(var(--line))] p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
                    <input className={inputCls} value={t.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Tên mẫu (VD: Xác nhận lịch khảo sát)" aria-label="Tên mẫu" />
                    <input className={cn(inputCls, 'font-mono')} value={t.templateId} onChange={(e) => upd({ templateId: e.target.value.trim() })} placeholder="Template ID" aria-label="Template ID" />
                    <button type="button" className="rounded p-2 hover:bg-[rgb(var(--ink)/0.06)]" onClick={() => setZ({ znsTemplates: hubCfg.zalo.znsTemplates.filter((_, k) => k !== i) })} aria-label="Xóa mẫu"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {t.params.map((p, j) => (
                      <div key={j} className="flex gap-2">
                        <input className={cn(inputBase, 'w-44 font-mono text-xs')} value={p.key} onChange={(e) => upd({ params: t.params.map((x, k) => (k === j ? { ...x, key: e.target.value.trim() } : x)) })} placeholder="tên_tham_số" aria-label="Tên tham số" />
                        <select className={cn(inputBase, 'min-w-0 flex-1 text-xs')} value={p.source} onChange={(e) => upd({ params: t.params.map((x, k) => (k === j ? { ...x, source: e.target.value } : x)) })} aria-label="Nguồn dữ liệu"><option value="">Nhập tay khi gửi</option>{Object.entries(ZNS_SOURCES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                        <button type="button" className="rounded p-1.5 hover:bg-[rgb(var(--ink)/0.06)]" onClick={() => upd({ params: t.params.filter((_, k) => k !== j) })} aria-label="Xóa tham số"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                    <button type="button" className="text-xs font-medium text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => upd({ params: [...t.params, { key: '', source: '' }] })}>+ Thêm tham số</button>
                  </div>
                </li>
              );
            })}
            {!hubCfg.zalo.znsTemplates.length && <li className="py-4 text-center text-sm text-[rgb(var(--muted))]">Chưa có mẫu ZNS</li>}
          </ul>
        </Panel>}

        {sub === 'kb' && <Panel title="Kiến thức cho AI" action={!ro && <div className="flex gap-2">{!kb.some((k) => k.rule?.kind === 'DEALER_GROWTH_BONUS') && <button type="button" className={cn(btnGhost, btnSm)} onClick={() => setKb((p) => [{ ...DEALER_BONUS_TEMPLATE, id: uid('kb'), updatedAt: Date.now(), updatedBy: me?.id }, ...p])}>+ Chính sách thưởng tăng trưởng</button>}<button type="button" className={cn(btnGhost, btnSm)} onClick={() => setKb((p) => [{ id: uid('kb'), title: 'Quy định mới', body: '', tags: [], updatedAt: Date.now(), updatedBy: me?.id }, ...p])}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm</button></div>}>
          <p className="mb-3 text-xs text-[rgb(var(--muted))]">Quy định, chính sách để @AI và Copilot tra cứu. Mục có quy tắc tính toán (thưởng tăng trưởng đại lý) được tính tự động trên doanh số trong CRM.</p>
          <ul className="space-y-3">
            {kb.map((k) => {
              const upd = (p: Partial<KbItem>) => setKb((all) => all.map((x) => (x.id === k.id ? { ...x, ...p, updatedAt: Date.now(), updatedBy: me?.id } : x)));
              return (
                <li key={k.id} className="rounded-md border border-[rgb(var(--line))] p-3">
                  <div className="flex gap-2"><input className={cn(inputCls, 'font-semibold')} value={k.title} onChange={(e) => upd({ title: e.target.value })} aria-label="Tiêu đề" /><button type="button" className="rounded p-2 hover:bg-[rgb(var(--ink)/0.06)]" onClick={() => setKb((all) => all.filter((x) => x.id !== k.id))} aria-label="Xóa"><Trash2 className="h-4 w-4" /></button></div>
                  <textarea className={cn(inputCls, 'mt-2 min-h-[72px] text-sm')} value={k.body} onChange={(e) => upd({ body: e.target.value })} aria-label="Nội dung" />
                  <input className={cn(inputCls, 'mt-2 text-xs')} defaultValue={k.tags.join(', ')} onBlur={(e) => upd({ tags: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} placeholder="Từ khóa, cách nhau dấu phẩy" aria-label="Từ khóa" />
                  {k.rule && (
                    <div className="mt-2 grid gap-2 rounded-md bg-[rgb(var(--sunken))] p-2.5 sm:grid-cols-4">
                      <Field label="Tăng trưởng tối thiểu (%)"><input type="number" className={inputCls} value={k.rule.minGrowthPct} onChange={(e) => upd({ rule: { ...k.rule!, minGrowthPct: Number(e.target.value) || 0 } })} /></Field>
                      <Field label="Mỗi bậc doanh thu (đ)"><MoneyInput value={k.rule.stepRevenue} onChange={(v) => upd({ rule: { ...k.rule!, stepRevenue: Math.max(1, v) } })} /></Field>
                      <Field label="Thưởng mỗi bậc (đ)"><MoneyInput value={k.rule.bonusPerStep} onChange={(v) => upd({ rule: { ...k.rule!, bonusPerStep: v } })} /></Field>
                      <Field label="Tính trên"><select className={inputCls} value={k.rule.base} onChange={(e) => upd({ rule: { ...k.rule!, base: e.target.value as KbRule['base'] } })}><option value="INCREASE">Toàn bộ phần tăng</option><option value="ABOVE_THRESHOLD">Phần vượt ngưỡng</option></select></Field>
                    </div>
                  )}
                </li>
              );
            })}
            {!kb.length && <li className="py-4 text-center text-sm text-[rgb(var(--muted))]">Chưa có mục kiến thức</li>}
          </ul>
        </Panel>}
      </fieldset>
      {sub === 'notify' && znsOn && <ZnsSettings />}
    </div>
  );
}

