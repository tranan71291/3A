'use client';

import { useEffect, useState } from 'react';
import { Database, Download, HardDrive, History, KeyRound, Lock, Pencil, Plus, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { Pagination, usePaged } from '../../components/controls';
import { Collapse, ConfirmDialog } from '../../components/crud';
import { Chip, EmptyState, Field, FilePicker, Modal, MoneyInput, Panel, StatCard, Table, useSticky } from '../../components/ui';
import { AGING, AUDIT_LABEL, bizMode, btnGhost, btnPrimary, btnSm, C, CLOUD_ON, DATA_VERSION, dataKey, fmtN, inputBase, inputCls, kpiGrid, orgOf, ORGS, rowCls, SESSION_KEY, SNAP_KEEP, storage, tdCls, tdFirst, tdLast, todayISO, uid, useApp, vnd, whQty } from '../../lib/core';
import { decryptBackup, encryptBackup } from '../../lib/security';
import { takeSnapshot } from '../../lib/storage';
import type { AgingScheme, AnyRec, AuditLevel, ConfirmState, EncryptedBackup, MfgConfig, SettingsTab, WarehouseInfo } from '../../lib/types';
import { cn } from '../../lib/utils';
import { PricingSettings } from '../platform/console';
import { CompanySettings } from './company';
import { EmailSettings } from './email';
import { GetflySettings } from './getfly';
import { HubSettings } from './hub-settings';
import { MarketingBudgetSettings } from './mkt-budget';
import { FundSettings, OrgSettings, SegmentSettings } from './my-account';
import { PermissionsSettings } from './permissions';
import { LegacyDemoPanel } from './sample-data';
import { BusinessModulesPanel } from './settings';
import { ZnsSettings } from './zns';

export function SecurityDataSettings() {
  const { security, setSecurity, auditLogs, users, userName, canDo, notify, audit, dataInfo, exportData, importData, restoreSnapshot, company, org, platform } = useApp();
  const canSec = canDo('security.manage');
  // Nhật ký hệ thống: chỉ tài khoản quản trị nền tảng 3A Group được xem
  const is3A = !!platform.userId;
  const canData = canDo('data.backup');
  const [p, setP] = useState(security);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [importFile, setImportFile] = useState<{ name: string; raw: AnyRec } | null>(null);
  const [importPass, setImportPass] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [lv, setLv] = useState<'ALL' | AuditLevel>('ALL');
  const logs = auditLogs.filter((x) => lv === 'ALL' || x.level === lv);
  const paged = usePaged(logs, 12);
  const weak = users.filter((u) => u.active && (CLOUD_ON ? !!u.mustChangePassword : !u.passwordHash || u.mustChangePassword));
  const locked = users.filter((u) => u.lockedUntil && u.lockedUntil > Date.now());
  const fails24 = auditLogs.filter((x) => (x.action === 'LOGIN_FAIL' || x.action === 'ACCOUNT_LOCKED') && x.at > Date.now() - 864e5).length;

  const savePolicy = () => {
    if (p.minPasswordLength < 8 || p.minPasswordLength > 64) return notify('Độ dài mật khẩu tối thiểu từ 8 đến 64', 'red');
    if (p.lockoutAttempts < 3 || p.lockoutAttempts > 20) return notify('Số lần sai từ 3 đến 20', 'red');
    if (p.idleMinutes < 5 || p.idleMinutes > 480) return notify('Thời gian tự đăng xuất từ 5 đến 480 phút', 'red');
    setSecurity(p);
    audit('SECURITY_POLICY', `Mật khẩu ≥${p.minPasswordLength}, khóa sau ${p.lockoutAttempts} lần / ${p.lockoutMinutes} phút, tự đăng xuất ${p.idleMinutes} phút, phiên ${p.sessionDays} ngày, chuyển vai trò ${p.roleSwitch ? 'bật' : 'tắt'}`, 'SECURITY');
    notify('Đã lưu chính sách bảo mật', 'teal');
  };
  const download = (name: string, text: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const doExport = async () => {
    if (pass.length < 10) return notify('Mật khẩu bản sao lưu tối thiểu 10 ký tự', 'red');
    if (pass !== pass2) return notify('Nhập lại mật khẩu không khớp', 'red');
    setBusy(true);
    try {
      const enc = await encryptBackup({ v: DATA_VERSION, org: org.id, data: exportData() }, pass, DATA_VERSION);
      download(`${(company.shortName || 'crm').toLowerCase()}-saoluu-v${DATA_VERSION}-${todayISO()}.json`, JSON.stringify(enc));
      audit('DATA_EXPORT', `Sao lưu mã hóa AES-GCM, phiên bản ${DATA_VERSION}`, 'SECURITY');
      notify('Đã tải bản sao lưu đã mã hóa. Cất mật khẩu riêng, mất mật khẩu sẽ không mở được file.', 'teal');
      setPass(''); setPass2('');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Không tạo được bản sao lưu', 'red');
    } finally { setBusy(false); }
  };
  const pickImport = async (files: File[]) => {
    try {
      const raw = JSON.parse(await files[0].text()) as AnyRec;
      if (raw.format !== 'vassh-backup') return notify('File không phải bản sao lưu của hệ thống', 'red');
      if ((raw.v ?? 0) > DATA_VERSION) return notify(`Bản sao lưu thuộc phiên bản ${raw.v}, mới hơn app (${DATA_VERSION}). Cập nhật app trước khi nhập.`, 'red');
      setImportFile({ name: files[0].name, raw });
    } catch { notify('Không đọc được file', 'red'); }
  };
  const doImport = async () => {
    if (!importFile) return;
    setBusy(true);
    try {
      const plain = await decryptBackup(importFile.raw as EncryptedBackup, importPass);
      if ((plain.org ?? ORGS[0].id) !== org.id) { notify(`Bản sao lưu thuộc doanh nghiệp ${orgOf(String(plain.org ?? ORGS[0].id)).shortName}, không nhập vào ${org.shortName} được`, 'red'); return; }
      setConfirm({
        title: 'Nhập bản sao lưu',
        message: <>Thay toàn bộ dữ liệu trên máy bằng bản sao lưu <b>{importFile.name}</b> (phiên bản {plain.v})? Dữ liệu hiện tại được chụp lại trước, khôi phục được ở mục Bản chụp tự động.</>,
        onConfirm: () => { importData((plain.data ?? {}) as Record<string, unknown>, Number(plain.v ?? 0)); setImportFile(null); setImportPass(''); notify('Đã nhập bản sao lưu', 'teal'); },
      });
    } catch (e) {
      audit('DATA_IMPORT_FAIL', `Mở bản sao lưu ${importFile.name} thất bại`, 'SECURITY');
      notify(e instanceof Error ? e.message : 'Không mở được bản sao lưu', 'red');
    } finally { setBusy(false); }
  };
  const resetLocal = () => setConfirm({
    title: 'Xóa dữ liệu trên máy này',
    message: 'Xóa toàn bộ dữ liệu app lưu trên trình duyệt này (đã tự chụp một bản trước khi xóa) và tải lại trang?',
    onConfirm: () => { takeSnapshot(org.id, 'truoc-khi-xoa'); audit('DATA_RESET', `Xóa dữ liệu ${org.shortName} trên máy`, 'SECURITY'); storage.del(dataKey(org.id)); storage.del(SESSION_KEY); setTimeout(() => window.location.reload(), 300); },
  });

  return (
    <div className="space-y-4">
      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="Phiên bản dữ liệu" value={`v${dataInfo.version}`} icon={Database} color={C.blue} sub={dataInfo.savedAt ? `Lưu lúc ${new Date(dataInfo.savedAt).toLocaleTimeString('vi-VN')}` : 'Chưa lưu'} />
        {CLOUD_ON ? <StatCard label="Lưu trữ" value="Máy chủ" icon={HardDrive} color={C.teal} sub="Supabase; tải bản sao lưu hằng tuần" /> : <StatCard label="Dung lượng" value={`${(dataInfo.bytes / 1024 / 1024).toFixed(2)} MB`} icon={HardDrive} color={dataInfo.bytes > 4 * 1024 * 1024 ? C.red : C.teal} sub="Giới hạn trình duyệt ~5 MB" />}
        <StatCard label="Mật khẩu yếu / tạm" value={String(weak.length)} icon={KeyRound} color={weak.length ? C.orange : C.teal} sub={locked.length ? `${locked.length} tài khoản đang bị khóa` : 'Không có tài khoản bị khóa'} />
        <StatCard label="Đăng nhập lỗi 24h" value={String(fails24)} icon={ShieldCheck} color={fails24 > 5 ? C.red : C.teal} sub="Sai mật khẩu / khóa tài khoản" />
      </div>

      <Collapse title="Sao lưu & khôi phục" summary="Tự lưu trên máy, chụp bản trước mỗi lần nâng cấp, sao lưu ra file có mã hóa" defaultOpen>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-semibold">Tải bản sao lưu dữ liệu {org.shortName} (mã hóa AES-256-GCM)</p>
            <p className="text-xs text-[rgb(var(--muted))]">Nên sao lưu trước khi dán bản app mới. Khóa bí mật tích hợp (API Key Getfly, mật khẩu SMTP, secret ZNS) không nằm trong bản sao lưu.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input className={inputCls} type="password" autoComplete="new-password" disabled={!canData} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Mật khẩu file (≥10 ký tự)" />
              <input className={inputCls} type="password" autoComplete="new-password" disabled={!canData} value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="Nhập lại" />
            </div>
            <button className={btnPrimary} disabled={!canData || busy} onClick={() => void doExport()}><Download className="h-4 w-4" aria-hidden />Tải bản sao lưu</button>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold">Nhập bản sao lưu</p>
            {importFile ? (
              <div className="space-y-2">
                <p className="text-xs text-[rgb(var(--muted))]">{importFile.name}, phiên bản {String(importFile.raw.v)}, tạo {new Date(Number(importFile.raw.exportedAt)).toLocaleString('vi-VN')}</p>
                <input className={inputCls} type="password" autoComplete="off" value={importPass} onChange={(e) => setImportPass(e.target.value)} placeholder="Mật khẩu file" />
                <div className="flex gap-2"><button className={btnPrimary} disabled={busy || !importPass} onClick={() => void doImport()}>Mở & nhập</button><button className={btnGhost} onClick={() => setImportFile(null)}>Hủy</button></div>
              </div>
            ) : (
              <FilePicker accept=".json,application/json" disabled={!canData} onFiles={(f) => void pickImport(f)} className={cn(btnGhost, 'inline-flex')}><Upload className="h-4 w-4" aria-hidden />Chọn file sao lưu</FilePicker>
            )}
            {CLOUD_ON ? <p className="pt-2 text-xs text-[rgb(var(--muted))]">Chế độ máy chủ: nhập bản sao lưu sẽ ghi đè dữ liệu {org.shortName} trên máy chủ cho mọi người. Nên tải bản sao lưu mã hóa hằng tuần (sao lưu tự động của Supabase tùy gói đang dùng).</p> : <>
            <p className="pt-2 text-sm font-semibold">Bản chụp tự động trên máy</p>
            <ul className="space-y-1.5">
              {dataInfo.snapshots.map((x) => (
                <li key={x.key} className="flex items-center gap-2 rounded bg-[rgb(var(--raised))] px-3 py-2 text-xs">
                  <History className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-hidden />
                  <span className="flex-1">{new Date(x.at).toLocaleString('vi-VN')}, dữ liệu v{x.version}</span>
                  <button className="text-[rgb(var(--secondary-fg))] hover:underline disabled:opacity-50" disabled={!canData} onClick={() => setConfirm({ title: 'Khôi phục bản chụp', message: `Khôi phục dữ liệu lúc ${new Date(x.at).toLocaleString('vi-VN')}? Dữ liệu hiện tại được chụp lại trước.`, onConfirm: () => restoreSnapshot(x.key) })}>Khôi phục</button>
                </li>
              ))}
              {!dataInfo.snapshots.length && <li className="text-xs text-[rgb(var(--muted))]">Chưa có. App tự chụp trước khi nâng cấp dữ liệu, nhập sao lưu hoặc khôi phục (giữ {SNAP_KEEP} bản gần nhất).</li>}
            </ul>
            <button className={cn(btnGhost, btnSm, 'text-[rgb(var(--danger-fg))]')} disabled={!canData} onClick={resetLocal}><Trash2 className="h-3.5 w-3.5" aria-hidden />Xóa dữ liệu trên máy này</button>
            </>}
          </div>
        </div>
      </Collapse>

      <Collapse title="Chính sách bảo mật" summary={`Mật khẩu ≥${security.minPasswordLength} ký tự, khóa sau ${security.lockoutAttempts} lần sai, tự đăng xuất ${security.idleMinutes} phút`} action={<button className={cn(btnPrimary, btnSm)} disabled={!canSec} onClick={savePolicy}>Lưu</button>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Độ dài mật khẩu tối thiểu"><input className={inputCls} type="number" disabled={!canSec} value={p.minPasswordLength} onChange={(e) => setP({ ...p, minPasswordLength: Number(e.target.value) })} /></Field>
          <Field label="Khóa sau số lần sai"><input className={inputCls} type="number" disabled={!canSec} value={p.lockoutAttempts} onChange={(e) => setP({ ...p, lockoutAttempts: Number(e.target.value) })} /></Field>
          <Field label="Thời gian khóa (phút)"><input className={inputCls} type="number" disabled={!canSec} value={p.lockoutMinutes} onChange={(e) => setP({ ...p, lockoutMinutes: Number(e.target.value) })} /></Field>
          <Field label="Tự đăng xuất (phút)"><input className={inputCls} type="number" disabled={!canSec} value={p.idleMinutes} onChange={(e) => setP({ ...p, idleMinutes: Number(e.target.value) })} /></Field>
          <Field label="Ghi nhớ đăng nhập (ngày)"><input className={inputCls} type="number" min={1} max={30} disabled={!canSec} value={p.sessionDays} onChange={(e) => setP({ ...p, sessionDays: Number(e.target.value) })} /></Field>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" disabled={!canSec} checked={p.forceChangeDefault} onChange={(e) => setP({ ...p, forceChangeDefault: e.target.checked })} />Bắt đổi mật khẩu khi đăng nhập bằng mật khẩu mặc định / tạm</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" disabled={!canSec} checked={p.roleSwitch} onChange={(e) => setP({ ...p, roleSwitch: e.target.checked })} />Cho phép Ban Giám đốc chuyển vai trò để xem thử (tắt khi chạy thật)</label>
        </div>
        {weak.length > 0 && <p className="mt-3 rounded bg-[rgb(var(--accent)/0.1)] p-3 text-xs text-[rgb(var(--accent-fg))]">{weak.length} tài khoản chưa đặt mật khẩu riêng: {weak.slice(0, 6).map((u) => u.name).join(', ')}{weak.length > 6 ? '...' : ''}. Họ sẽ phải đổi ở lần đăng nhập tới.</p>}
      </Collapse>

      {is3A && <Panel title={`Nhật ký hệ thống (${auditLogs.length}) · chỉ 3A Group`} action={
        <select className={cn(inputBase, 'w-auto py-1.5 text-xs')} value={lv} onChange={(e) => setLv(e.target.value as 'ALL' | AuditLevel)} aria-label="Mức độ">
          <option value="ALL">Mọi mức</option><option value="SECURITY">Bảo mật</option><option value="WARN">Cảnh báo</option><option value="INFO">Thông tin</option>
        </select>
      }>
        <>
            <Table stt={Math.max(0, paged.from - 1)} head={['Thời gian', 'Người thực hiện', 'Thao tác', 'Chi tiết']} minW={720}>
              {paged.slice.map((x) => (
                <tr key={x.id} className={rowCls}>
                  <td className={cn(tdFirst, 'whitespace-nowrap text-xs tabular-nums')}>{new Date(x.at).toLocaleString('vi-VN')}</td>
                  <td className={cn(tdCls, 'text-xs')}>{x.userId ? userName(x.userId) : 'Chưa đăng nhập'}</td>
                  <td className={tdCls}><Chip tone={x.level === 'SECURITY' ? 'red' : x.level === 'WARN' ? 'orange' : 'muted'}>{AUDIT_LABEL[x.action] ?? x.action}</Chip></td>
                  <td className={cn(tdLast, 'text-xs text-[rgb(var(--muted))]')}>{x.detail}</td>
                </tr>
              ))}
            </Table>
            {!logs.length && <EmptyState text={<>Chưa có sự kiện.</>} art="doc" />}
            <Pagination paged={paged} unit="sự kiện" />
        </>
      </Panel>}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

/** Cài đặt › Kho hàng: danh mục kho, người quản lý, trạng thái; kho tổng không xóa / tạm ngưng được */
export function WarehouseSettings() {
  const { warehouses, setWarehouses, skus, users, userName, canDo, notify } = useApp();
  const can = canDo('settings.edit') || canDo('po.manage');
  const [edit, setEdit] = useState<WarehouseInfo | null>(null);
  const qtyIn = (id: string) => skus.reduce((a, s) => a + whQty(s, id, warehouses), 0);
  const skuIn = (id: string) => skus.filter((s) => whQty(s, id, warehouses) > 0).length;
  const blank: WarehouseInfo = { id: '', code: '', name: '', address: '', active: true };
  const f = edit ?? blank;
  const err: Record<string, string> = {};
  if (edit) {
    if (!/^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(f.code)) err.code = 'Mã viết hoa không dấu, 2–20 ký tự';
    else if (warehouses.some((w) => w.code === f.code && w.id !== f.id)) err.code = 'Mã kho đã tồn tại';
    if (f.name.trim().length < 3) err.name = 'Nhập tên kho';
    if (!f.active && f.id && qtyIn(f.id) > 0) err.active = 'Kho còn hàng: điều chuyển hết hàng trước khi tạm ngưng';
  }
  const save = () => {
    if (!edit || Object.keys(err).length) return;
    const clean = { ...edit, name: edit.name.trim(), address: edit.address.trim() };
    if (clean.id) setWarehouses((all) => all.map((w) => (w.id === clean.id ? clean : w)));
    else setWarehouses((all) => [...all, { ...clean, id: uid('wh') }]);
    notify(clean.id ? `Đã cập nhật ${clean.code}` : `Đã thêm kho ${clean.code}`, 'teal'); setEdit(null);
  };
  return (
    <Panel title={`Danh mục kho (${warehouses.length})`} action={<button className={cn(btnPrimary, btnSm)} disabled={!can} onClick={() => setEdit({ ...blank })}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm kho</button>}>
      <p className="mb-3 text-sm text-[rgb(var(--muted))]">Tồn kho mỗi SKU được phân bổ theo kho. Kho tổng nhận phần còn lại (hàng về từ PO, giải phóng giữ chỗ…). Điều chuyển giữa các kho ở Sản phẩm › bấm vào số tồn.</p>
      <Table head={['Mã kho', 'Tên kho / địa chỉ', 'Quản lý kho', 'SKU có tồn', 'Tổng số lượng', 'Trạng thái', '']} minW={820}>
        {warehouses.map((w) => (
          <tr key={w.id} className={rowCls}>
            <td className={cn(tdFirst, 'font-mono text-xs font-semibold text-[rgb(var(--accent-fg))]')}>{w.code}{w.main && <span className="ml-2 font-sans"><Chip tone="blue">Kho tổng</Chip></span>}</td>
            <td className={tdCls}><p className="font-medium">{w.name}</p><p className="text-xs text-[rgb(var(--muted))]">{w.address || '—'}</p></td>
            <td className={tdCls}>{w.managerId ? userName(w.managerId) : '—'}</td>
            <td className={cn(tdCls, 'text-right tabular-nums')}>{skuIn(w.id)}</td>
            <td className={cn(tdCls, 'text-right tabular-nums')}>{fmtN(qtyIn(w.id))}</td>
            <td className={tdCls}><Chip tone={w.active ? 'teal' : 'muted'}>{w.active ? 'Đang hoạt động' : 'Tạm ngưng'}</Chip></td>
            <td className={cn(tdLast, 'text-right')}><button className={cn(btnGhost, 'p-1.5')} disabled={!can} onClick={() => setEdit({ ...w })} aria-label={`Sửa kho ${w.code}`}><Pencil className="h-3.5 w-3.5" aria-hidden /></button></td>
          </tr>
        ))}
      </Table>
      {edit && (
        <Modal title={edit.id ? `Sửa kho ${edit.code}` : 'Thêm kho'} onClose={() => setEdit(null)} footer={<><button className={btnGhost} onClick={() => setEdit(null)}>Hủy</button><button className={btnPrimary} disabled={Object.keys(err).length > 0} onClick={save}>Lưu</button></>}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Mã kho *" error={err.code}><input className={inputCls} value={f.code} onChange={(e) => setEdit({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '') })} placeholder="VD: KHO-HCM" /></Field>
            <Field label="Tên kho *" error={err.name}><input className={inputCls} value={f.name} onChange={(e) => setEdit({ ...f, name: e.target.value })} placeholder="VD: Kho Chi nhánh HCM" /></Field>
            <Field label="Địa chỉ" className="sm:col-span-2"><input className={inputCls} value={f.address} onChange={(e) => setEdit({ ...f, address: e.target.value })} /></Field>
            <Field label="Người quản lý kho"><select className={inputCls} value={f.managerId ?? ''} onChange={(e) => setEdit({ ...f, managerId: e.target.value || undefined })}><option value="">Chưa chọn</option>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
            <Field label="Trạng thái" error={err.active}><select className={inputCls} disabled={f.main} value={f.active ? '1' : '0'} onChange={(e) => setEdit({ ...f, active: e.target.value === '1' })}><option value="1">Đang hoạt động</option><option value="0">Tạm ngưng</option></select></Field>
          </div>
        </Modal>
      )}
    </Panel>
  );
}

export function SettingsModule() {
  const { canDo, company, platform, org, presetQuery } = useApp();
  const [tab, setTab] = useSticky<SettingsTab>('SettingsModule.tab', 'org');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (presetQuery && /^[a-z]+$/.test(presetQuery)) setTab(presetQuery as SettingsTab); }, [presetQuery]);
  const mode = bizMode(company);
  // Tích hợp do 3A cấp phép theo hợp đồng: tắt ở Console thì ẩn tab cấu hình tương ứng
  const feat = platform.tenants.find((t) => t.id === org.id)?.features;
  const all: { id: SettingsTab; label: string; show: boolean; group: string }[] = [
    { id: 'company', label: 'Thông tin doanh nghiệp', show: true, group: 'Tổ chức' },
    { id: 'org', label: 'Phòng ban & nhân sự', show: true, group: 'Tổ chức' },
    { id: 'perms', label: 'Phân quyền', show: true, group: 'Tổ chức' },
    { id: 'accounting', label: 'Kế toán & công nợ', show: true, group: 'Nghiệp vụ' },
    { id: 'pricing', label: 'Bảng đơn giá & thanh toán', show: mode !== 'TRADING', group: 'Nghiệp vụ' },
    { id: 'warehouses', label: 'Kho hàng', show: mode !== 'MFG', group: 'Nghiệp vụ' },
    { id: 'segments', label: mode === 'MFG' ? 'Loại & nguồn khách' : 'Phân loại khách hàng', show: true, group: 'Nghiệp vụ' },
    { id: 'fund', label: 'Quỹ Hãng 3M', show: mode !== 'MFG', group: 'Marketing & quỹ' },
    { id: 'mkt', label: 'Ngân sách Marketing', show: true, group: 'Marketing & quỹ' },
    { id: 'hub', label: 'AI, Zalo OA & ZNS', show: true, group: 'Tích hợp' },
    { id: 'email', label: 'Email SMTP', show: feat?.smtp !== false, group: 'Tích hợp' },
    { id: 'getfly', label: 'Getfly API', show: mode !== 'MFG' && feat?.getfly !== false, group: 'Tích hợp' },
    { id: 'security', label: 'Dữ liệu & bảo mật', show: true, group: 'Hệ thống' },
  ];
  const tabs = all.filter((x) => x.show);
  const cur = tabs.some((x) => x.id === tab) ? tab : 'org';
  // Đường dẫn trực tiếp tới từng mục cài đặt: #/<doanh-nghiệp>/settings/<mục> (vd. settings/warehouses)
  useEffect(() => { const base = `#/${org.id}/settings`; if (location.hash.startsWith(base) && location.hash !== `${base}/${cur}`) history.replaceState(null, '', `${base}/${cur}`); }, [cur, org.id]);
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      {/* Điều hướng dọc: danh sách mục cài đặt (màn nhỏ: ô chọn) */}
      <nav aria-label="Mục cài đặt" className="lg:sticky lg:top-20 lg:w-56 lg:shrink-0">
        <select className={cn(inputBase, 'lg:hidden')} value={cur} onChange={(e) => setTab(e.target.value as SettingsTab)} aria-label="Mục cài đặt">
          {tabs.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
        <ul className="hidden rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-1.5 lg:block">
          {tabs.map((x, i) => (
            <li key={x.id}>
              {(i === 0 || tabs[i - 1].group !== x.group) && <p className={cn('px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--faint))]', i > 0 ? 'mt-2 border-t border-[rgb(var(--line))] pt-3' : 'pt-1')}>{x.group}</p>}
              <button
                className={cn('flex w-full items-center rounded border-l-2 px-3 py-2 text-left text-sm transition-colors', cur === x.id ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.1)] font-semibold text-[rgb(var(--fg))]' : 'border-transparent text-[rgb(var(--muted))] hover:bg-[rgb(var(--raised))] hover:text-[rgb(var(--fg))]')}
                aria-current={cur === x.id ? 'page' : undefined}
                onClick={() => setTab(x.id)}
              >{x.label}</button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1 space-y-5">
      {!canDo('settings.edit') && (
        <p className="flex items-center gap-2 rounded border border-[rgb(var(--line))] bg-[rgb(var(--raised))] px-4 py-3 text-sm text-[rgb(var(--muted))]"><Lock className="h-4 w-4" aria-hidden />Chế độ chỉ xem. Chỉ Giám đốc BOD được sửa cấu hình (trừ ngân sách Marketing).</p>
      )}
      {cur === 'company' && <><CompanySettings /><BusinessModulesPanel /></>}
      {cur === 'security' && <><LegacyDemoPanel /><SecurityDataSettings /></>}
      {cur === 'org' && <OrgSettings />}
      {cur === 'pricing' && <PricingSettings />}
      {cur === 'accounting' && <AccountingSettings />}

      {cur === 'warehouses' && <WarehouseSettings />}
      {cur === 'fund' && <FundSettings />}
      {cur === 'mkt' && <MarketingBudgetSettings />}
      {cur === 'segments' && <SegmentSettings />}
      {cur === 'getfly' && <GetflySettings />}
      {cur === 'email' && <EmailSettings />}
      {cur === 'perms' && <PermissionsSettings />}
      {cur === 'hub' && <><HubSettings />{feat?.zns !== false && <ZnsSettings />}</>}
      </div>
    </div>
  );
}

// ---------------- Kế toán & công nợ ----------------

export function AccountingSettings() {
  const { mfgConfig, setMfgConfig, canDo, company, audit, notify } = useApp();
  const mode = bizMode(company);
  const can = canDo('settings.edit') || canDo('cash.manage');
  const [f, setF] = useState(mfgConfig);
  const num = (k: keyof MfgConfig, v: string, min = 0) => setF({ ...f, [k]: Math.max(min, Number(v) || 0) });
  const save = () => {
    setMfgConfig((c) => ({ ...c, agingScheme: f.agingScheme ?? 'AGE_30_60', creditDays: f.creditDays, dueDays: f.dueDays, salesCommissionPct: f.salesCommissionPct, installCommissionPct: f.installCommissionPct, openingCash: f.openingCash, openingBank: f.openingBank }));
    audit('ACCOUNTING_CONFIG', `Công nợ ${mode === 'MFG' ? f.dueDays : f.creditDays} ngày, hoa hồng ${f.salesCommissionPct}% + ${f.installCommissionPct}%, số dư đầu ${vnd(f.openingCash + f.openingBank)}`, 'WARN');
    notify('Đã lưu cấu hình kế toán', 'teal');
  };
  return (
    <Panel title="Kế toán & công nợ">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {mode !== 'MFG' && <Field label="Số ngày công nợ mặc định (thương mại)" hint="Dùng khi khách chưa có hợp đồng ghi số ngày công nợ"><input className={inputCls} type="number" min={0} disabled={!can} value={f.creditDays} onChange={(e) => num('creditDays', e.target.value)} /></Field>}
        {mode !== 'TRADING' && <Field label="Hạn thanh toán sau mốc (ngày)" hint="Cọc, giao hàng, nghiệm thu: quá số ngày này tính vào tuổi nợ"><input className={inputCls} type="number" min={0} disabled={!can} value={f.dueDays} onChange={(e) => num('dueDays', e.target.value)} /></Field>}
        {mode !== 'TRADING' && <Field label="Hoa hồng sales / kỹ thuật (%)" hint="Trên giá trị hợp đồng trước VAT"><input className={inputCls} type="number" min={0} max={30} step={0.1} disabled={!can} value={f.salesCommissionPct} onChange={(e) => num('salesCommissionPct', e.target.value)} /></Field>}
        {mode !== 'TRADING' && <Field label="Hoa hồng đội lắp đặt (%)" hint="Chia đều đội trưởng và thành viên lắp đơn"><input className={inputCls} type="number" min={0} max={30} step={0.1} disabled={!can} value={f.installCommissionPct} onChange={(e) => num('installCommissionPct', e.target.value)} /></Field>}
        <Field label="Nhóm tuổi nợ (bảng theo dõi công nợ)" className="sm:col-span-2 xl:col-span-1" hint={AGING[f.agingScheme ?? 'AGE_30_60'].note}>
          <select className={inputCls} disabled={!can} value={f.agingScheme ?? 'AGE_30_60'} onChange={(e) => setF({ ...f, agingScheme: e.target.value as AgingScheme })}>
            {(Object.keys(AGING) as AgingScheme[]).map((k) => <option key={k} value={k}>{AGING[k].label}</option>)}
          </select>
        </Field>
        <Field label="Số dư đầu quỹ tiền mặt"><MoneyInput value={f.openingCash} disabled={!can} onChange={(n) => setF({ ...f, openingCash: n })} /></Field>
        <Field label="Số dư đầu tài khoản ngân hàng"><MoneyInput value={f.openingBank} disabled={!can} onChange={(n) => setF({ ...f, openingBank: n })} /></Field>
      </div>
      <div className="mt-4 flex gap-2"><button className={btnPrimary} disabled={!can} onClick={save}>Lưu cấu hình</button><button className={btnGhost} onClick={() => setF(mfgConfig)}>Hoàn tác</button></div>
      <p className="mt-3 text-xs text-[rgb(var(--muted))]">Phiếu thu / chi tự sinh: thu tiền khách khi kế toán xác nhận phiếu thu; chi công tác phí, chi triển khai sự kiện khi kế toán xác nhận thanh toán; chi hoa hồng khi quyết toán; thu thặng dư quỹ MDF khi hạch toán.</p>
    </Panel>
  );
}

