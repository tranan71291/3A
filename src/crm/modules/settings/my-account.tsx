'use client';

import { useState } from 'react';
import { AlertTriangle, KeyRound, Pencil, Plus, Settings, Sparkles, Trash2, Upload, X, Zap } from 'lucide-react';
import { Avatar, RowMenu } from '../../components/controls';
import { CatalogTable, codeFrom, Collapse, ConfirmDialog } from '../../components/crud';
import { Chip, Code, Field, Modal, MoneyInput, ProgressBar, SetBlock, SideCard, SideSheet, Table, useOverlay } from '../../components/ui';
import { fundUsage } from '../../lib/business';
import { cloudMessage } from '../../lib/cloud';
import { btnGhost, btnPrimary, btnSm, C, cloud, CLOUD_ON, compact, deptIcon, digits, FUND_LABEL, inputBase, inputCls, OPEN_STATUSES, POP_LABEL, progYear, ROLE_LABEL, rowCls, SETTLEMENT_LABEL, shrinkImage, tdCls, tdFirst, tdLast, tierFor, TONES, useApp, usedByType, vnd } from '../../lib/core';
import type { Budget, BudgetCategory, ConfirmState, Department, DeptCode, FundCode, Opt, PopDocDef, SegmentDef, Settlement, TierRule, Tone, User } from '../../lib/types';
import { cn } from '../../lib/utils';
import { DeptModal, UserModal } from '../platform/console';

// =====================================================================
//  TÀI KHOẢN CỦA TÔI: ảnh đại diện, thông tin cá nhân, chữ ký, mật khẩu
// =====================================================================
export function MyAccountSheet({ onClose, onPassword }: { onClose: () => void; onPassword: () => void }) {
  const { me, setUsers, dept, role, notify, audit, company } = useApp();
  const [f, setF] = useState({ name: me.name, title: me.title ?? '', phone: me.phone ?? '', birthday: me.birthday ?? '', avatar: me.avatar ?? '', signature: me.signature ?? '' });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const pick = async (file?: File) => { if (!file) return; if (!/^image\//.test(file.type)) return notify('Chọn file ảnh', 'red'); set('avatar', await shrinkImage(file, 256)); };
  const save = () => {
    setUsers((p) => p.map((u) => (u.id === me.id ? { ...u, name: f.name.trim() || u.name, title: f.title.trim() || undefined, phone: f.phone.trim() || undefined, birthday: f.birthday || undefined, avatar: f.avatar || undefined, signature: f.signature.trim() || undefined } : u)));
    audit('PROFILE_UPDATE', 'Cập nhật hồ sơ cá nhân');
    notify('Đã lưu hồ sơ của bạn', 'teal'); onClose();
  };
  return (
    <SideSheet title="Tài khoản của tôi" sub={`${ROLE_LABEL[role]} · ${dept(me.dept)?.name ?? 'Ban Giám đốc'} · ${company.shortName || company.appName}`} onClose={onClose} width="sm:w-[520px]"
      footer={<><button className={cn(btnGhost, 'mr-auto')} onClick={() => { onClose(); onPassword(); }}><KeyRound className="h-4 w-4" aria-hidden />Đổi mật khẩu</button><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} disabled={!f.name.trim()} onClick={save}>Lưu hồ sơ</button></>}>
      <div className="space-y-5">
        <div className="flex items-center gap-4 rounded-md border border-[rgb(var(--line))] p-4">
          {f.avatar ? <img src={f.avatar} alt="Ảnh đại diện" className="h-20 w-20 shrink-0 rounded-full object-cover" /> : <Avatar name={f.name || me.name} size={80} />}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Ảnh đại diện</p>
            <div className="flex flex-wrap gap-2">
              <label className={cn(btnGhost, btnSm, 'cursor-pointer')}><Upload className="h-3.5 w-3.5" aria-hidden />Tải ảnh lên<input type="file" accept="image/*" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} /></label>
              {f.avatar && <button className={cn(btnGhost, btnSm, 'text-[rgb(var(--danger-fg))]')} onClick={() => set('avatar', '')}>Bỏ ảnh</button>}
            </div>
            <p className="text-[11px] text-[rgb(var(--muted))]">Ảnh vuông, tự thu nhỏ còn 256px. Hiển thị ở bảng tin, tin nhắn, danh bạ.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Họ tên"><input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Chức danh"><input className={inputCls} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="VD: Trưởng phòng Kinh doanh" /></Field>
          <Field label="Điện thoại"><input type="tel" autoComplete="tel" className={inputCls} inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Ngày sinh"><input type="date" className={inputCls} value={f.birthday} onChange={(e) => set('birthday', e.target.value)} /></Field>
          <Field label="Email đăng nhập" className="sm:col-span-2"><input className={cn(inputCls, 'opacity-70')} value={me.email} readOnly /></Field>
        </div>
        <Field label="Chữ ký email / báo giá" hint="Tự chèn cuối email báo giá và tin chăm sóc khách"><textarea className={cn(inputCls, 'min-h-[88px]')} value={f.signature} onChange={(e) => set('signature', e.target.value)} placeholder={`${me.name}\n${f.title || ROLE_LABEL[role]}\n${company.legalName || company.appName}\n${f.phone}`} /></Field>
        <div className="rounded-md bg-[rgb(var(--sunken))] px-3 py-2.5 text-xs text-[rgb(var(--muted))]">
          <p>Vai trò, phòng ban và quyền do Giám đốc cấp ở Cài đặt &gt; Phân quyền.</p>
          {me.lastLoginAt && <p className="mt-0.5">Đăng nhập gần nhất: {new Date(me.lastLoginAt).toLocaleString('vi-VN')}</p>}
        </div>
      </div>
    </SideSheet>
  );
}

export function OrgSettings() {
  const { departments, setDepartments, users, setUsers, leads, customers, programs, me, canDo, userName, dept, notify, org , platform } = useApp();
  const canEdit = canDo('settings.edit');
  const [deptModal, setDeptModal] = useState<{ code?: string } | null>(null);
  const [userModal, setUserModal] = useState<{ id?: string } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [userFilter, setUserFilter] = useState<'ALL' | DeptCode>('ALL');
  const shownUsers = users.filter((u) => userFilter === 'ALL' || u.dept === userFilter);

  const askDeleteDept = (d: Department) => {
    const staff = users.filter((u) => u.dept === d.code).length;
    const open = leads.filter((l) => l.dept === d.code && OPEN_STATUSES.includes(l.status)).length;
    const cust = customers.filter((c) => c.dept === d.code).length;
    const prog = programs.filter((p) => p.dept === d.code).length;
    const reasons = [staff && `${staff} nhân sự`, open && `${open} lead đang xử lý`, cust && `${cust} khách hàng`, prog && `${prog} chương trình quỹ`].filter(Boolean);
    setConfirm({
      title: 'Xóa phòng ban',
      message: <>Xóa <b>{d.name}</b>?</>,
      blocked: reasons.length ? `Phòng đang có ${reasons.join(', ')}. Chuyển sang phòng khác trước khi xóa, hoặc bỏ chọn "Đang hoạt động" để ngừng phòng.` : undefined,
      onConfirm: () => { setDepartments((p) => p.filter((x) => x.code !== d.code)); notify(`Đã xóa ${d.name}`, 'orange'); },
    });
  };

  const askDeleteUser = (u: User) => {
    const open = leads.filter((l) => l.assignee === u.id && OPEN_STATUSES.includes(l.status)).length;
    const cust = customers.filter((c) => c.amId === u.id).length;
    const reasons = [open && `${open} lead đang xử lý`, cust && `${cust} khách hàng phụ trách`].filter(Boolean);
    setConfirm({
      title: 'Xóa nhân sự',
      message: <>Xóa tài khoản <b>{u.name}</b> ({u.email})? Lịch sử thao tác vẫn giữ tên người tạo.</>,
      blocked: u.id === me.id ? 'Không thể xóa tài khoản đang đăng nhập.' : reasons.length ? `Nhân sự đang có ${reasons.join(', ')}. Chuyển giao trước khi xóa, hoặc khóa tài khoản (Inactive) để giữ dữ liệu.` : undefined,
      onConfirm: () => {
        setUsers((p) => p.filter((x) => x.id !== u.id));
        setDepartments((p) => p.map((d) => (d.headId === u.id ? { ...d, headId: undefined } : d)));
        notify(`Đã xóa ${u.name}`, 'orange');
      },
    });
  };

  const actU = users.filter((u) => u.active);
  const idle30 = actU.filter((u) => !u.lastLoginAt || Date.now() - u.lastLoginAt > 30 * 864e5).length;
  const seats = platform.tenants.find((t) => t.id === org.id)?.seats;
  const ago = (t?: number) => { if (!t) return 'chưa đăng nhập'; const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? 'hôm nay' : d === 1 ? 'hôm qua' : `${d} ngày trước`; };
  return (
    <div className="space-y-4">
      <div className="kpi-strip grid grid-cols-2 lg:grid-cols-4">
        {([['Phòng ban', String(departments.filter((d) => d.active).length), `${departments.filter((d) => d.receivesLeads && d.active).length} nhận lead`, false], ['Tài khoản hoạt động', String(actU.length), `${users.length - actU.length} ngừng`, false], ['Chưa đăng nhập 30 ngày', String(idle30), 'tài khoản', idle30 > 0], ['Ghế bản quyền', seats ? `${actU.length} / ${seats}` : String(actU.length), seats ? 'theo hợp đồng' : '', false]] as const).map(([l, v, sub, warn]) => (
          <div key={l} className="px-4 py-3"><p className="text-[12.5px] text-[rgb(var(--muted))]">{l}</p><p className={cn('text-[22px] font-medium leading-7 tabular-nums', warn && 'text-[rgb(var(--warn))]')}>{v}</p><p className="text-xs text-[rgb(var(--muted))]">{sub}</p></div>
        ))}
      </div>
      <SetBlock flush
        title="Phòng ban"
        sub={`${departments.length} phòng, ${departments.filter((d) => d.receivesLeads && d.active).length} phòng nhận lead`}
        action={<button className={cn(btnGhost, btnSm)} disabled={!canEdit} onClick={() => setDeptModal({})}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm phòng ban</button>}
      >
        {/* v61: mã phòng và SLA là cột thêm (bộ chọn cột) để bảng vừa khung 1440px, không cuộn ngang */}
        <Table head={['Mã', 'Phòng ban', 'Trưởng phòng', <span key="n" className="block text-right">Nhân sự</span>, 'Nhận lead', 'SLA', <span key="l" className="block text-right">Lead đang xử lý</span>, 'Trạng thái', '']} minW={820} optional={[0, 5]} select={false}>
          {departments.map((d) => {
            const Icon = deptIcon(d.code);
            return (
              <tr key={d.code} className={rowCls}>
                <td className={tdFirst}><Code>{d.code}</Code></td>
                <td className={tdCls}><span className="flex items-center gap-2 font-medium"><Icon className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden /><span className="min-w-0 truncate">{d.name}</span></span></td>
                <td className={tdCls}>{d.headId ? userName(d.headId) : <span className="text-[rgb(var(--muted))]">Chưa chỉ định</span>}</td>
                <td className={cn(tdCls, 'text-right tabular-nums')}>{users.filter((u) => u.dept === d.code && u.active).length}</td>
                <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{d.receivesLeads ? 'Có' : 'Không'}</td>
                <td className={cn(tdCls, 'font-mono text-xs text-[rgb(var(--fg2))]')}>{d.receivesLeads ? `${d.slaMinutes} phút` : '—'}</td>
                <td className={cn(tdCls, 'text-right tabular-nums')}>{leads.filter((l) => l.dept === d.code && OPEN_STATUSES.includes(l.status)).length}</td>
                <td className={tdCls}><Chip tone={d.active ? 'teal' : 'muted'}>{d.active ? 'Hoạt động' : 'Ngừng'}</Chip></td>
                <td className={cn(tdLast, 'whitespace-nowrap text-right')}>
                  <RowMenu label={`Thao tác ${d.name}`} items={[{ label: 'Sửa', icon: Pencil, disabled: !canEdit, onClick: () => setDeptModal({ code: d.code }) }, { label: 'Xóa', icon: Trash2, danger: true, disabled: !canEdit, onClick: () => askDeleteDept(d) }]} />
                </td>
              </tr>
            );
          })}
        </Table>
      </SetBlock>

      <SetBlock flush
        title="Nhân sự và tài khoản"
        sub={`${users.filter((u) => u.active).length} đang hoạt động, ${users.filter((u) => !u.active).length} đã khóa`}
        action={
          <div className="flex flex-wrap gap-2">
            <select className={cn(inputBase, 'w-auto py-1.5')} value={userFilter} onChange={(e) => setUserFilter(e.target.value)} aria-label="Lọc phòng ban">
              <option value="ALL">Mọi phòng ban</option>
              {departments.map((d) => <option key={d.code} value={d.code}>{d.short}</option>)}
            </select>
            <button className={cn(btnPrimary, btnSm)} disabled={!canEdit} onClick={() => setUserModal({})}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm nhân sự</button>
          </div>
        }
      >
        {/* v61: email và chức vụ là cột thêm (bộ chọn cột); tên rút gọn "…" thay vì bị cắt */}
        <Table head={['Nhân sự', 'Email', 'Vai trò', 'Chức vụ', 'Phòng ban', <span key="h" className="block text-right">Hạn mức duyệt</span>, 'Đăng nhập', 'Trạng thái', '']} minW={860} optional={[1, 3]} select={false}>
          {shownUsers.map((u) => {
            const headOf = departments.find((d) => d.headId === u.id);
            return (
              <tr key={u.id} className={rowCls}>
                <td className={tdFirst}>
                  <span className="flex items-center gap-2" title={u.email}><span className="shrink-0"><Avatar name={u.name} size={24} /></span><span className="min-w-0 truncate font-medium">{u.name}{u.id === me.id && <span className="ml-1 text-xs font-normal text-[rgb(var(--muted))]">(bạn)</span>}</span></span>
                </td>
                <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{u.email}</td>
                <td className={tdCls}>{ROLE_LABEL[u.role]}</td>
                <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{headOf ? `Trưởng ${headOf.short}` : '—'}</td>
                <td className={tdCls}>{dept(u.dept)?.short ?? <span className="text-[rgb(var(--muted))]">Ban Giám đốc</span>}</td>
                <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{u.approvalLimit ? compact(u.approvalLimit) : <span className="text-[rgb(var(--muted))]">—</span>}</td>
                <td className={cn(tdCls, 'text-[13px]', u.active && (!u.lastLoginAt || Date.now() - u.lastLoginAt > 30 * 864e5) ? 'text-[rgb(var(--warn))]' : 'text-[rgb(var(--fg2))]')}>{ago(u.lastLoginAt)}</td>
                <td className={tdCls}>
                  <button disabled={!canEdit || u.id === me.id} onClick={() => {
                    setUsers((p) => p.map((x) => (x.id === u.id ? { ...x, active: !x.active } : x)));
                    if (CLOUD_ON && u.active) void cloud.revoke(u.email, org.id).catch((er) => notify(cloudMessage(er), 'red'));
                    notify(CLOUD_ON && !u.active ? `Đã mở ${u.name}: bấm "Đặt lại mật khẩu" để cấp lại quyền đăng nhập` : `${u.active ? 'Đã khóa' : 'Đã mở'} tài khoản ${u.name}`, u.active ? 'orange' : 'teal');
                  }} className="disabled:cursor-not-allowed" aria-label={`${u.active ? 'Khóa' : 'Mở'} tài khoản ${u.name}`}>
                    <Chip tone={u.active ? 'teal' : 'muted'}>{u.active ? 'Hoạt động' : 'Đã khóa'}</Chip>
                  </button>
                </td>
                <td className={cn(tdLast, 'whitespace-nowrap text-right')}>
                  <button className={cn(btnGhost, 'mr-1 p-1.5')} disabled={!canEdit} onClick={() => setUserModal({ id: u.id })} aria-label={`Sửa ${u.name}`}><Pencil className="h-3.5 w-3.5" /></button>
                  <button className={cn(btnGhost, 'p-1.5 hover:text-[rgb(var(--danger-fg))]')} disabled={!canEdit} onClick={() => askDeleteUser(u)} aria-label={`Xóa ${u.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            );
          })}
        </Table>
      </SetBlock>

      {deptModal && <DeptModal code={deptModal.code} onClose={() => setDeptModal(null)} />}
      {userModal && <UserModal id={userModal.id} onClose={() => setUserModal(null)} />}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

// ---------------- Quỹ Hãng 3M: MDF + CS theo số tiền ----------------

export function CategoryTable({ fund }: { fund: FundCode }) {
  const { categories, setCategories, popDocs, programs, claims, budget, setBudget, canDo, notify } = useApp();
  const canEdit = canDo('settings.edit');
  // Số tiền hiển thị là phân bổ của năm tài chính đang xem
  const rows = categories.filter((c) => c.fund === fund).map((c) => ({ ...c, amount: budget.declared === false ? 0 : budget.allocations?.[c.code] ?? c.amount }));
  const fundTotal = fund === 'MDF' ? budget.mdfTotal : budget.csTotal;
  const allocated = rows.reduce((s, c) => s + c.amount, 0);
  const docOpts: Opt[] = popDocs.map((d) => ({ value: d.code, label: d.name }));
  const palette = [C.orange, C.teal, C.blue, C.sand, '#A78BFA', '#F472B6', '#34D399', '#60A5FA', '#FBBF24'];
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-[rgb(var(--muted))]">Đã phân bổ</span>
        <span className="tabular-nums font-medium">{vnd(allocated)} / {vnd(fundTotal)}</span>
        <div className="w-48"><ProgressBar value={allocated} max={fundTotal} /></div>
        {allocated < fundTotal && <span className="text-xs text-[rgb(var(--muted))]">Chưa phân bổ {compact(fundTotal - allocated)}</span>}
        {allocated > fundTotal && <span className="text-xs text-[rgb(var(--danger-fg))]">Vượt tổng {compact(allocated - fundTotal)}</span>}
      </div>
      <CatalogTable<BudgetCategory>
        rows={rows}
        rowKey={(r) => r.code}
        entity="hạng mục"
        canEdit={canEdit}
        columns={[
          { label: 'Hạng mục', render: (r) => r.name },
          { label: 'Ngân sách', render: (r) => <span className="tabular-nums">{compact(r.amount)}</span> },
          { label: 'Đã dùng', render: (r) => { const u = usedByType(r.code, claims, programs, budget.fiscalYear); return <div className="w-36"><ProgressBar value={u} max={r.amount} /><p className="mt-1 text-xs tabular-nums text-[rgb(var(--muted))]">{compact(u)}</p></div>; } },
          { label: 'Quyết toán', render: (r) => <Chip tone={r.settlement === 'LUMP_SUM' ? 'orange' : 'blue'}>{SETTLEMENT_LABEL[r.settlement]}</Chip> },
          { label: 'Chứng từ claim', render: (r) => <span className="text-xs text-[rgb(var(--muted))]">{r.required.map((d) => POP_LABEL[d] ?? d).join(', ') || 'Chưa cấu hình'}</span> },
          { label: 'Màu', render: (r) => <i className="block h-3 w-3 rounded-full" style={{ background: r.color }} /> },
        ]}
        fields={[
          { key: 'name', label: 'Tên hạng mục', type: 'text', wide: true },
          { key: 'amount', label: 'Ngân sách (VNĐ)', type: 'money' },
          { key: 'settlement', label: 'Hình thức quyết toán với 3M', type: 'select', options: (Object.keys(SETTLEMENT_LABEL) as Settlement[]).map((x) => ({ value: x, label: SETTLEMENT_LABEL[x] })), hint: 'Khoán: được giữ thặng dư. Hoàn ứng: claim tối đa bằng chi phí thực tế' },
          { key: 'color', label: 'Màu biểu đồ', type: 'color' },
          { key: 'required', label: 'Chứng từ bắt buộc khi claim', type: 'multi', options: docOpts },
        ]}
        blank={() => ({ name: '', amount: 0, settlement: 'ACTUAL_COST', color: palette[rows.length % palette.length], required: ['VAT_INVOICE'] })}
        toForm={(r) => ({ ...r })}
        fromForm={(v, prev) => ({ code: prev?.code ?? codeFrom(String(v.name), categories.map((c) => c.code)), name: String(v.name).trim(), fund, amount: Number(v.amount), color: String(v.color), required: (v.required as string[]) ?? [], settlement: (v.settlement as Settlement) ?? 'ACTUAL_COST' })}
        validate={(v, prev) => {
          const e: Record<string, string> = {};
          const amount = Number(v.amount);
          const used = prev ? usedByType(prev.code, claims, programs, budget.fiscalYear) : 0;
          if (String(v.name ?? '').trim().length < 3) e.name = 'Tối thiểu 3 ký tự';
          if (amount <= 0) e.amount = 'Nhập số tiền';
          else if (amount < used) e.amount = `Đã dùng ${compact(used)}, không thể thấp hơn`;
          else if (allocated - (prev?.amount ?? 0) + amount > fundTotal) e.amount = `Vượt tổng ${FUND_LABEL[fund]} (còn ${compact(fundTotal - allocated + (prev?.amount ?? 0))})`;
          if (!((v.required as string[]) ?? []).length) e.required = 'Chọn ít nhất một chứng từ';
          return e;
        }}
        onSave={(row, prev) => {
          setCategories((p) => (prev ? p.map((c) => (c.code === prev.code ? { ...row, amount: c.amount } : c)) : [...p, row]));
          setBudget((b) => ({ ...b, allocations: { ...(b.allocations ?? {}), [row.code]: row.amount } }));
          notify(`Đã lưu hạng mục ${row.name}, ngân sách năm ${budget.fiscalYear}: ${compact(row.amount)}`, 'teal');
        }}
        onDelete={(r) => { setCategories((p) => p.filter((c) => c.code !== r.code)); notify(`Đã xóa hạng mục ${r.name}`, 'orange'); }}
        deleteBlocked={(r) => { const n = programs.filter((p) => p.type === r.code).length + claims.filter((c) => c.programType === r.code).length; return n ? `Hạng mục đang có ${n} chương trình / hồ sơ claim. Không thể xóa để giữ số liệu quyết toán.` : undefined; }}
      />
    </>
  );
}

/** Tiêu chí duyệt claim: chứng từ, ảnh, hạn nộp — dùng chung cho mọi năm */
export function ClaimRulesSection({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { policy, setPolicy, categories, setCategories, popDocs, setPopDocs, claims, canDo, notify } = useApp();
  const canEdit = canDo('settings.edit');
  const [p, setP] = useState(policy);
  const [touched, setTouched] = useState(false);
  const e: Record<string, string> = {};
  if (p.claimWindowDays < 15 || p.claimWindowDays > 180) e.window = 'Từ 15 đến 180 ngày';
  if (p.rules.minPhotos < 1 || p.rules.minPhotos > 10) e.photos = 'Từ 1 đến 10 ảnh';
  const err = (k: string) => (touched ? e[k] : undefined);
  const savePolicy = () => {
    setTouched(true);
    if (Object.keys(e).length) return notify('Kiểm tra lại các ô đang báo lỗi', 'red');
    setPolicy(p);
    notify('Đã lưu tiêu chí duyệt claim', 'teal');
  };
  const toggleDoc = (cat: string, d: string) =>
    setCategories((cs) => cs.map((c) => (c.code === cat ? { ...c, required: c.required.includes(d) ? c.required.filter((x) => x !== d) : [...c.required, d] } : c)));
  return (
      <Collapse defaultOpen={defaultOpen} title="Tiêu chí duyệt claim (áp dụng mọi năm)" summary={`${popDocs.length} loại chứng từ, tối thiểu ${policy.rules.minPhotos} ảnh`} action={<button className={cn(btnPrimary, btnSm)} disabled={!canEdit} onClick={savePolicy}>Lưu quy tắc</button>}>
        {/* v61: nhãn một dòng để các ô nhập thẳng hàng; hai ô tích căn theo đáy ô nhập */}
        <div className="mb-5 grid grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto_auto] xl:gap-x-6">
          <Field label="Hạn nộp claim (ngày)" error={err('window')}><input className={inputCls} type="number" disabled={!canEdit} value={p.claimWindowDays} onChange={(ev) => setP({ ...p, claimWindowDays: Number(ev.target.value) })} /></Field>
          <Field label="Số ảnh hiện trường tối thiểu" error={err('photos')}><input className={inputCls} type="number" min={1} max={10} disabled={!canEdit} value={p.rules.minPhotos} onChange={(ev) => setP({ ...p, rules: { ...p.rules, minPhotos: Number(ev.target.value) } })} /></Field>
          <label className="flex h-10 items-center gap-2 whitespace-nowrap text-sm"><input type="checkbox" className="h-4 w-4 shrink-0 accent-[rgb(var(--accent))]" disabled={!canEdit} checked={p.rules.requireWatermark} onChange={(ev) => setP({ ...p, rules: { ...p.rules, requireWatermark: ev.target.checked } })} />Bắt buộc ảnh có watermark</label>
          <label className="flex h-10 items-center gap-2 whitespace-nowrap text-sm"><input type="checkbox" className="h-4 w-4 shrink-0 accent-[rgb(var(--accent))]" disabled={!canEdit} checked={p.rules.gpsBlocking} onChange={(ev) => setP({ ...p, rules: { ...p.rules, gpsBlocking: ev.target.checked } })} />Thiếu GPS là lỗi chặn</label>
        </div>
        <p className="-mt-3 mb-5 text-[12px] text-[rgb(var(--muted))]">Hạn nộp tính từ ngày kết thúc chương trình, từ 15 đến 180 ngày</p>

        <h3 className="mb-2 text-sm font-semibold">Loại chứng từ</h3>
        <CatalogTable<PopDocDef>
          rows={popDocs}
          rowKey={(r) => r.code}
          entity="loại chứng từ"
          canEdit={canEdit}
          columns={[
            { label: 'Tên chứng từ', render: (r) => r.name },
            { label: 'Loại', render: (r) => (r.system ? <Chip tone="blue">Hệ thống</Chip> : <Chip>Tùy chỉnh</Chip>) },
            { label: 'Dùng ở hạng mục', render: (r) => categories.filter((c) => c.required.includes(r.code)).length },
          ]}
          fields={[{ key: 'name', label: 'Tên chứng từ', type: 'text', wide: true, hint: 'Ảnh hiện trường, hóa đơn GTGT và danh sách ký tên có kiểm tra tự động' }]}
          blank={() => ({ name: '' })}
          toForm={(r) => ({ name: r.name })}
          fromForm={(v, prev) => ({ code: prev?.code ?? codeFrom(String(v.name), popDocs.map((d) => d.code)), name: String(v.name).trim(), system: prev?.system })}
          validate={(v, prev): Record<string, string> => (String(v.name ?? '').trim().length < 3 ? { name: 'Tối thiểu 3 ký tự' } : popDocs.some((d) => d.code !== prev?.code && d.name.toLowerCase() === String(v.name).trim().toLowerCase()) ? { name: 'Tên đã có' } : {})}
          onSave={(row, prev) => { setPopDocs((d) => (prev ? d.map((x) => (x.code === prev.code ? row : x)) : [...d, row])); notify('Đã lưu loại chứng từ', 'teal'); }}
          onDelete={(r) => { setPopDocs((d) => d.filter((x) => x.code !== r.code)); setCategories((cs) => cs.map((c) => ({ ...c, required: c.required.filter((x) => x !== r.code) }))); notify(`Đã xóa ${r.name}`, 'orange'); }}
          deleteBlocked={(r) => (r.system ? 'Chứng từ hệ thống có kiểm tra tự động, không thể xóa. Có thể bỏ yêu cầu ở bảng bên dưới.' : claims.some((c) => c.proofs.some((x) => x.type === r.code)) ? 'Đã có hồ sơ claim tải chứng từ loại này.' : undefined)}
        />

        <h3 className="mb-2 mt-6 text-sm font-semibold">Chứng từ bắt buộc theo hạng mục</h3>
        {/* v61: bảng ma trận: tên hạng mục xuống dòng trong tiêu đề, không ô chọn dòng / nút chọn cột (không cuộn ngang ở 1440px) */}
        <Table stack={false} select={false} colPick={false} head={['Chứng từ', ...categories.map((c) => <span key={c.code} className="block whitespace-normal text-center leading-4">{c.name}</span>)]} minW={Math.max(560, 180 + categories.length * 64)}>
          {popDocs.map((d) => (
            <tr key={d.code} className={rowCls}>
              <td className={tdFirst}>{d.name}</td>
              {categories.map((c, i) => (
                <td key={c.code} className={cn(i === categories.length - 1 ? tdLast : tdCls, 'text-center')}>
                  <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" disabled={!canEdit} checked={c.required.includes(d.code)} onChange={() => toggleDoc(c.code, d.code)} aria-label={`${d.name} cho ${c.name}`} />
                </td>
              ))}
            </tr>
          ))}
        </Table>
      </Collapse>
  );
}

/** Khai báo / sửa hạn mức một năm: Hãng, MDF, CS và phân bổ từng hạng mục (theo % hoặc số tiền) */
export function BudgetYearModal({ year, initialYear, onClose }: { year?: number; initialYear?: number; onClose: () => void }) {
  const { budgets, setBudgets, categories, programs, claims, setFiscalYear, notify, budget } = useApp();
  const existing = budgets.find((b) => b.fiscalYear === year);
  const latest = [...budgets].sort((a, c) => c.fiscalYear - a.fiscalYear)[0];
  const base = existing ?? latest ?? budget;
  const [y, setY] = useState(existing?.fiscalYear ?? initialYear ?? (latest ? latest.fiscalYear + 1 : new Date().getFullYear()));
  const [vendor, setVendor] = useState(base.vendor);
  const [mdf, setMdf] = useState(base.mdfTotal);
  const [cs, setCs] = useState(base.csTotal);
  const [mode, setMode] = useState<'AMOUNT' | 'PERCENT'>('AMOUNT');
  const [alloc, setAlloc] = useState<Record<string, number>>(() => Object.fromEntries(categories.map((c) => [c.code, base.allocations?.[c.code] ?? c.amount])));
  const [touched, setTouched] = useState(false);
  const fundOf = (f: FundCode) => (f === 'MDF' ? mdf : cs);
  const sumOf = (f: FundCode) => categories.filter((c) => c.fund === f).reduce((s, c) => s + (alloc[c.code] ?? 0), 0);
  const usage = existing ? fundUsage(existing.fiscalYear, programs, claims) : { spent: 0, committed: 0 };
  const errs: string[] = [];
  if (!existing && budgets.some((b) => b.fiscalYear === y)) errs.push(`Năm ${y} đã được khai báo`);
  if (y < 2000 || y > 2100) errs.push('Năm không hợp lệ');
  if (vendor.trim().length < 2) errs.push('Nhập tên Hãng tài trợ');
  if (mdf <= 0) errs.push('Nhập hạn mức quỹ MDF');
  if (cs < 0) errs.push('Hạn mức CS không âm');
  if (sumOf('MDF') > mdf) errs.push(`Phân bổ MDF vượt hạn mức ${compact(sumOf('MDF') - mdf)}`);
  if (sumOf('CS') > cs) errs.push(`Phân bổ CS vượt hạn mức ${compact(sumOf('CS') - cs)}`);
  if (existing && mdf + cs < (existing.openingSpent ?? 0) + usage.spent + usage.committed) errs.push(`Tổng trần không thấp hơn số đã tiêu và giữ chỗ (${compact((existing.openingSpent ?? 0) + usage.spent + usage.committed)})`);

  const save = () => {
    setTouched(true);
    if (errs.length) return;
    const rec: Budget = { ...base, fiscalYear: y, vendor: vendor.trim(), mdfTotal: mdf, csTotal: cs, total: mdf + cs, allocations: alloc, periodStart: `${y}-01-01`, periodEnd: `${y}-12-31`, spent: 0, committed: 0, openingSpent: existing?.openingSpent ?? 0, note: existing?.note ?? '', declared: undefined };
    setBudgets((list) => (existing ? list.map((b) => (b.fiscalYear === existing.fiscalYear ? rec : b)) : [...list, rec]));
    if (!existing) setFiscalYear(y);
    notify(existing ? `Đã cập nhật hạn mức năm ${y}` : `Đã khai báo ngân sách năm ${y}: ${compact(mdf + cs)}`, 'teal');
    onClose();
  };

  return (
    <Modal title={existing ? `Sửa hạn mức năm ${y}` : 'Khai báo ngân sách năm mới'} onClose={onClose} wide footer={<><span className="mr-auto self-center text-sm tabular-nums">Tổng trần <b>{vnd(mdf + cs)}</b></span><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}>{existing ? 'Lưu' : 'Khai báo'}</button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Field label="Năm tài chính"><input className={inputCls} type="number" disabled={!!existing} value={y} onChange={(e) => setY(Number(e.target.value))} /></Field>
        <Field label="Hãng tài trợ" className="sm:col-span-3"><input className={inputCls} value={vendor} onChange={(e) => setVendor(e.target.value)} /></Field>
        <Field label="Hạn mức quỹ MDF" className="sm:col-span-2"><MoneyInput value={mdf} onChange={setMdf} /></Field>
        <Field label="Hạn mức quỹ CS" className="sm:col-span-2"><MoneyInput value={cs} onChange={setCs} /></Field>
      </div>
      <div className="mb-2 mt-5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Phân bổ theo hạng mục</h3>
        <div className="flex rounded bg-[rgb(var(--bg))] p-0.5 text-xs" role="radiogroup" aria-label="Cách nhập">
          {(['AMOUNT', 'PERCENT'] as const).map((m) => <button key={m} role="radio" aria-checked={mode === m} className={cn('rounded-md px-3 py-1.5 font-medium', mode === m ? 'bg-[rgb(var(--surface))] font-semibold text-[rgb(var(--fg))] shadow-sm ring-1 ring-[rgb(var(--line))]' : 'text-[rgb(var(--muted))]')} onClick={() => setMode(m)}>{m === 'AMOUNT' ? 'Số tiền' : 'Tỷ lệ %'}</button>)}
        </div>
      </div>
      {(['MDF', 'CS'] as FundCode[]).map((f) => (
        <div key={f} className="mb-4">
          <p className={cn('mb-1.5 text-xs font-medium', sumOf(f) > fundOf(f) ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--muted))]')}>{FUND_LABEL[f]}: đã phân bổ {compact(sumOf(f))} / {compact(fundOf(f))}{fundOf(f) > sumOf(f) ? `, còn ${compact(fundOf(f) - sumOf(f))}` : ''}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {categories.filter((c) => c.fund === f).map((c) => {
              const amt = alloc[c.code] ?? 0;
              const pctv = fundOf(f) ? Math.round((amt / fundOf(f)) * 1000) / 10 : 0;
              return (
                <label key={c.code} className="flex items-center gap-2 rounded bg-[rgb(var(--raised))] px-3 py-2 text-sm">
                  <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  {mode === 'AMOUNT' ? (
                    <input className={cn(inputBase, 'w-36 py-1 text-right text-xs tabular-nums')} inputMode="numeric" value={amt ? amt.toLocaleString('vi-VN') : ''} onChange={(e) => setAlloc({ ...alloc, [c.code]: digits(e.target.value) })} aria-label={`Ngân sách ${c.name}`} />
                  ) : (
                    <span className="flex items-center gap-1"><input className={cn(inputBase, 'w-20 py-1 text-right text-xs tabular-nums')} type="number" min={0} max={100} step={0.5} value={pctv} onChange={(e) => setAlloc({ ...alloc, [c.code]: Math.round((fundOf(f) * Number(e.target.value)) / 100) })} aria-label={`Tỷ lệ ${c.name}`} />%<span className="w-16 text-right text-[11px] tabular-nums text-[rgb(var(--muted))]">{compact(amt)}</span></span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      ))}
      {touched && errs.length > 0 && <ul className="space-y-0.5 text-xs text-[rgb(var(--danger-fg))]">{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
    </Modal>
  );
}

/** Cấu hình một năm: hạn mức, ngân sách từng hạng mục (thêm / sửa / xóa) và tiêu chí claim */
export function YearConfigModal({ onClose }: { onClose: () => void }) {
  const ov = useOverlay();
  const { budget } = useApp();
  const [editLimits, setEditLimits] = useState(false);
  return (
    <div className={cn('fixed inset-0 z-50 flex flex-col bg-[rgb(var(--bg))]', !ov.top && 'invisible')} aria-hidden={!ov.top || undefined} role="dialog" aria-modal="true" aria-label="Cấu hình năm tài chính">
      <header className="flex items-center gap-3 border-b border-[rgb(var(--line))] px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-6">
        <Settings className="h-5 w-5 text-[rgb(var(--accent))]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">Cấu hình hạng mục & tiêu chí claim năm {budget.fiscalYear}</p>
          <p className="truncate text-xs text-[rgb(var(--muted))]">{budget.vendor}: MDF {compact(budget.mdfTotal)} + CS {compact(budget.csTotal)} = {compact(budget.total)}</p>
        </div>
        <button className={cn(btnGhost, btnSm)} onClick={() => setEditLimits(true)}><Pencil className="h-3.5 w-3.5" aria-hidden />Sửa hạn mức</button>
        <button className={cn(btnGhost, 'p-2')} onClick={onClose} aria-label="Đóng"><X className="h-5 w-5" /></button>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        <Collapse defaultOpen title={`Ngân sách MDF theo hạng mục (${budget.fiscalYear})`}><CategoryTable fund="MDF" /></Collapse>
        <Collapse defaultOpen title={`Ngân sách CS theo hạng mục (${budget.fiscalYear})`}><CategoryTable fund="CS" /></Collapse>
        <ClaimRulesSection />
      </div>
      {editLimits && <BudgetYearModal year={budget.fiscalYear} onClose={() => setEditLimits(false)} />}
    </div>
  );
}

export function FundSettings() {
  const { budget, budgets, setBudgets, setFiscalYear, programs, claims, canDo } = useApp();
  const canEdit = canDo('settings.edit');
  const [declare, setDeclare] = useState<{ year?: number } | null>(null);
  const [config, setConfig] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const rows = [...budgets].sort((a, c) => c.fiscalYear - a.fiscalYear);
  return (
    <div className="space-y-4">
      {budget.declared === false && (
        <div className="flex flex-col gap-2 rounded-md border border-[rgb(var(--accent)/0.4)] bg-[rgb(var(--accent)/0.1)] px-4 py-3 sm:flex-row sm:items-center">
          <AlertTriangle className="hidden h-5 w-5 text-[rgb(var(--accent-fg))] sm:block" aria-hidden />
          <p className="flex-1 text-sm text-[rgb(var(--accent-fg))]">Năm {budget.fiscalYear} (đang chọn trên bộ lọc thời gian) chưa khai báo ngân sách Hãng.</p>
          <button className={cn(btnPrimary, btnSm)} disabled={!canEdit} onClick={() => setDeclare({ year: budget.fiscalYear })}><Plus className="h-3.5 w-3.5" aria-hidden />Khai báo năm {budget.fiscalYear}</button>
        </div>
      )}
      <SetBlock title="Hạn mức quỹ theo năm" action={<button className={cn(btnGhost, btnSm)} disabled={!canEdit} onClick={() => setDeclare({})}><Plus className="h-3.5 w-3.5" aria-hidden />Khai báo năm mới</button>} flush>
        <Table head={['Năm', 'Hãng tài trợ', <span key="m" className="block text-right">MDF (đ)</span>, <span key="c" className="block text-right">CS (đ)</span>, <span key="t" className="block text-right">Tổng trần (đ)</span>, 'Đã dùng', 'Trạng thái', '']} minW={860} select={false}>
          {rows.map((x) => {
            const active = x.fiscalYear === budget.fiscalYear;
            const u = fundUsage(x.fiscalYear, programs, claims);
            const cap = x.mdfTotal + x.csTotal;
            const used = cap ? Math.min(100, Math.round(((u.spent + u.committed) / cap) * 100)) : 0;
            return (
              <tr key={x.fiscalYear} className={rowCls}>
                <td className={tdFirst}><b className="font-medium tabular-nums">{x.fiscalYear}</b></td>
                <td className={tdCls}><span className="block max-w-[200px] truncate" title={x.vendor}>{x.vendor}</span></td>
                <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{x.mdfTotal.toLocaleString('vi-VN')}</td>
                <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{x.csTotal.toLocaleString('vi-VN')}</td>
                <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{cap.toLocaleString('vi-VN')}</td>
                <td className={tdCls}><span data-status className="flex items-center gap-2" title={`Đã chi ${vnd(u.spent)}, đang giữ ${vnd(u.committed)}`}><span className="h-1.5 w-12 overflow-hidden rounded-full bg-[rgb(var(--ink)/0.08)]"><span className="block h-full rounded-full bg-[rgb(var(--fg))]" style={{ width: `${used}%` }} /></span><span className="font-mono text-xs tabular-nums text-[rgb(var(--fg2))]">{used}%</span></span></td>
                <td className={tdCls}><span data-status className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]"><span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-[rgb(var(--success))]' : 'bg-[rgb(var(--ink)/0.3)]')} aria-hidden />{active ? 'Đang kích hoạt' : x.fiscalYear < budget.fiscalYear ? 'Đã qua' : 'Kế hoạch'}</span></td>
                <td className={cn(tdLast, 'whitespace-nowrap text-right')}>
                  <button className={cn(btnGhost, 'p-1.5')} onClick={() => { setFiscalYear(x.fiscalYear); setConfig(true); }} title="Cấu hình hạng mục & tiêu chí claim" aria-label={`Cấu hình năm ${x.fiscalYear}`}><Settings className="h-3.5 w-3.5" aria-hidden /></button>
                  <button className={cn(btnGhost, 'p-1.5 hover:text-[rgb(var(--danger-fg))]')} disabled={!canEdit} onClick={() => setConfirm({
                    title: `Xóa ngân sách năm ${x.fiscalYear}`, message: <>Xóa khai báo ngân sách năm {x.fiscalYear}?</>,
                    blocked: programs.some((p) => progYear(p) === x.fiscalYear) ? 'Năm này đã có chương trình / claim, giữ lại để tra cứu lịch sử.' : undefined,
                    onConfirm: () => setBudgets((list) => list.filter((y) => y.fiscalYear !== x.fiscalYear)),
                  })} aria-label={`Xóa năm ${x.fiscalYear}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            );
          })}
        </Table>
      </SetBlock>
      <p className="px-1 text-xs text-[rgb(var(--muted))]">Đã dùng = đã Hãng duyệt chi + đang giữ chỗ cho chương trình. Năm kích hoạt theo bộ lọc thời gian trên đầu trang.</p>
      <ClaimRulesSection defaultOpen />
      {declare && <BudgetYearModal initialYear={declare.year} onClose={() => setDeclare(null)} />}
      {config && <YearConfigModal onClose={() => setConfig(false)} />}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

// ---------------- Phân loại khách hàng: nhóm & hạng ----------------

/** Đề xuất xếp hạng: khách có doanh số năm không khớp hạng hiện tại (tính theo quy tắc hạng), duyệt từng khách */
export function TierSuggest() {
  const { customers, setCustomers, tierRules, canDo, notify, audit } = useApp();
  const can = canDo('settings.edit');
  const list = customers.filter((c) => tierFor(c.ytdRevenue, tierRules) !== c.tier).sort((x, y) => y.ytdRevenue - x.ytdRevenue);
  const name = (t: string) => tierRules.find((r) => r.tier === t)?.name ?? (t || 'chưa xếp');
  const apply = (ids: string[]) => {
    setCustomers((p) => p.map((c) => (ids.includes(c.id) ? { ...c, tier: tierFor(c.ytdRevenue, tierRules) } : c)));
    audit('CUSTOMER_TIER', `Xếp hạng lại ${ids.length} khách theo doanh số năm`);
    notify(`Đã xếp hạng lại ${ids.length} khách`, 'teal');
  };
  return (
    <SideCard title="Đề xuất xếp hạng" icon={Sparkles} sub="theo doanh số năm">
      {!list.length ? <p className="py-2 text-xs text-[rgb(var(--muted))]">Mọi khách đang đúng hạng theo doanh số.</p> : (
        <>
          <ul className="divide-y divide-[rgb(var(--ink)/0.06)]">
            {list.slice(0, 6).map((c) => (
              <li key={c.id} className="flex items-start gap-2 py-2.5">
                <span className={cn('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', (tierRules.find((r) => r.tier === tierFor(c.ytdRevenue, tierRules))?.minRevenue ?? 0) > (tierRules.find((r) => r.tier === c.tier)?.minRevenue ?? 0) ? 'bg-[rgb(var(--success))]' : 'bg-[rgb(var(--accent))]')} aria-hidden />
                <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium">{c.name} → {name(tierFor(c.ytdRevenue, tierRules))}</p><p className="text-xs text-[rgb(var(--muted))]">đang {name(c.tier)} · doanh số năm {compact(c.ytdRevenue)}</p></div>
                {can && <button type="button" className={cn(btnGhost, btnSm)} onClick={() => apply([c.id])}>Duyệt</button>}
              </li>
            ))}
          </ul>
          {can && list.length > 1 && <button type="button" className={cn(btnGhost, btnSm, 'mt-2')} onClick={() => apply(list.map((c) => c.id))}>Duyệt tất cả {list.length} khách</button>}
        </>
      )}
    </SideCard>
  );
}

export function SegmentSettings() {
  const { segments, setSegments, tierRules, setTierRules, customers, setCustomers, leads, departments, canDo, notify } = useApp();
  const canEdit = canDo('settings.edit');
  const routable = departments.filter((d) => d.active && d.receivesLeads);
  const deptOpts: Opt[] = routable.map((d) => ({ value: d.code, label: d.name }));
  const mismatched = customers.filter((c) => tierFor(c.ytdRevenue, tierRules) !== c.tier);
  const dShort = (code: string) => departments.find((d) => d.code === code)?.short ?? code;

  return (
    <div className="space-y-4">
      <SetBlock flush title="Nhóm khách hàng" sub={`${segments.length} nhóm, phân lead theo khu vực Bắc / Nam`}>
        <p className="mb-3 text-sm text-[rgb(var(--muted))]">Khi Marketing phân lead tự động: khách hiện hữu giữ phòng đang phụ trách, còn lại chọn phòng theo nhóm và khu vực của lead.</p>
        <CatalogTable<SegmentDef>
          rows={segments}
          rowKey={(r) => r.code}
          entity="nhóm khách hàng"
          canEdit={canEdit}
          columns={[
            { label: 'Nhóm', render: (r) => r.name },
            { label: 'Miền Bắc', render: (r) => dShort(r.deptNorth) },
            { label: 'Miền Nam', render: (r) => dShort(r.deptSouth) },
            { label: 'Nhận MDF', render: (r) => (r.mdfEligible ? <Chip tone="teal">Có</Chip> : <Chip>Không</Chip>) },
            { label: 'Điểm lead', render: (r) => r.points },
            { label: 'Khách hàng', render: (r) => <span className="tabular-nums">{customers.filter((c) => c.segment === r.code).length}</span> },
            { label: 'Lead', render: (r) => <span className="tabular-nums">{leads.filter((l) => l.segment === r.code).length}</span> },
          ]}
          fields={[
            { key: 'name', label: 'Tên nhóm', type: 'text', wide: true },
            { key: 'deptNorth', label: 'Phòng tiếp nhận Miền Bắc', type: 'select', options: deptOpts },
            { key: 'deptSouth', label: 'Phòng tiếp nhận Miền Nam', type: 'select', options: deptOpts },
            { key: 'points', label: 'Điểm chấm lead (0–20)', type: 'number' },
            { key: 'mdfEligible', label: 'Thuộc diện nhận quỹ MDF / CS', type: 'checkbox' },
          ]}
          blank={() => ({ name: '', deptNorth: routable[0]?.code ?? '', deptSouth: routable[0]?.code ?? '', points: 10, mdfEligible: true })}
          toForm={(r) => ({ ...r })}
          fromForm={(v, prev) => ({ code: prev?.code ?? codeFrom(String(v.name), segments.map((s) => s.code)), name: String(v.name).trim(), deptNorth: String(v.deptNorth), deptSouth: String(v.deptSouth), points: Number(v.points), mdfEligible: !!v.mdfEligible, system: prev?.system })}
          validate={(v, prev) => {
            const e: Record<string, string> = {};
            if (String(v.name ?? '').trim().length < 3) e.name = 'Tối thiểu 3 ký tự';
            else if (segments.some((s) => s.code !== prev?.code && s.name.toLowerCase() === String(v.name).trim().toLowerCase())) e.name = 'Tên nhóm đã có';
            if (!v.deptNorth) e.deptNorth = 'Chọn phòng';
            if (!v.deptSouth) e.deptSouth = 'Chọn phòng';
            if (Number(v.points) < 0 || Number(v.points) > 20) e.points = 'Từ 0 đến 20';
            return e;
          }}
          onSave={(row, prev) => { setSegments((p) => (prev ? p.map((s) => (s.code === prev.code ? row : s)) : [...p, row])); notify(`Đã lưu nhóm ${row.name}`, 'teal'); }}
          onDelete={(r) => { setSegments((p) => p.filter((s) => s.code !== r.code)); notify(`Đã xóa nhóm ${r.name}`, 'orange'); }}
          deleteBlocked={(r) => {
            if (r.system) return 'Nhóm mặc định của hệ thống, không thể xóa.';
            const n = customers.filter((c) => c.segment === r.code).length + leads.filter((l) => l.segment === r.code).length;
            return n ? `Đang có ${n} khách hàng / lead thuộc nhóm này. Chuyển sang nhóm khác trước khi xóa.` : undefined;
          }}
        />
      </SetBlock>

      {/* v61: bảng hạng đủ rộng (không cắt cột thao tác) — thẻ đề xuất đặt bên phải chỉ ở màn rất rộng */}
      <div className="grid grid-cols-1 gap-4 min-[1680px]:grid-cols-[1fr_320px]">
        <div className="min-w-0">
      <SetBlock flush
        title="Hạng khách hàng"
        sub={`${tierRules.length} hạng${mismatched.length ? `, ${mismatched.length} khách lệch hạng` : ''}`}
        action={<button className={cn(btnGhost, btnSm)} disabled={!canEdit || !mismatched.length} onClick={() => { setCustomers((p) => p.map((c) => ({ ...c, tier: tierFor(c.ytdRevenue, tierRules) }))); notify(`Đã phân hạng lại ${mismatched.length} khách hàng`, 'teal'); }}><Zap className="h-3.5 w-3.5" aria-hidden />Áp dụng phân hạng tự động ({mismatched.length})</button>}
      >
        <CatalogTable<TierRule>
          rows={[...tierRules].sort((a, b) => b.minRevenue - a.minRevenue)}
          rowKey={(r) => r.tier}
          entity="hạng"
          canEdit={canEdit}
          columns={[
            { label: 'Hạng', render: (r) => r.name },
            { label: 'Doanh số năm từ', render: (r) => <span className="tabular-nums">{compact(r.minRevenue)}</span> },
            { label: 'Hạn mức MDF / năm', render: (r) => <span className="tabular-nums">{compact(r.mdfCap)}</span> },
            { label: 'Hiển thị', render: (r) => <Chip tone={r.tone}>{r.name}</Chip> },
            { label: 'Khách hiện tại', render: (r) => <span className="tabular-nums">{customers.filter((c) => c.tier === r.tier).length}</span> },
            { label: 'Khách theo quy tắc', render: (r) => <span className="tabular-nums">{customers.filter((c) => tierFor(c.ytdRevenue, tierRules) === r.tier).length}</span> },
          ]}
          fields={[
            { key: 'name', label: 'Tên hạng', type: 'text' },
            { key: 'tone', label: 'Màu nhãn', type: 'select', options: TONES.map((t) => ({ value: t, label: { blue: 'Xanh dương', orange: 'Cam', teal: 'Xanh ngọc', muted: 'Xám', red: 'Đỏ' }[t] })) },
            { key: 'minRevenue', label: 'Doanh số năm từ', type: 'money' },
            { key: 'mdfCap', label: 'Hạn mức tài trợ MDF / năm', type: 'money' },
          ]}
          blank={() => ({ name: '', tone: 'muted', minRevenue: 0, mdfCap: 0 })}
          toForm={(r) => ({ ...r })}
          fromForm={(v, prev) => ({ tier: prev?.tier ?? codeFrom(String(v.name), tierRules.map((t) => t.tier)), name: String(v.name).trim(), tone: v.tone as Tone, minRevenue: Number(v.minRevenue), mdfCap: Number(v.mdfCap) })}
          validate={(v, prev) => {
            const e: Record<string, string> = {};
            if (String(v.name ?? '').trim().length < 2) e.name = 'Nhập tên hạng';
            if (tierRules.some((t) => t.tier !== prev?.tier && t.minRevenue === Number(v.minRevenue))) e.minRevenue = 'Ngưỡng doanh số trùng với hạng khác';
            if (prev && prev.minRevenue === 0 && Number(v.minRevenue) !== 0 && !tierRules.some((t) => t.tier !== prev.tier && t.minRevenue === 0)) e.minRevenue = 'Cần giữ một hạng có ngưỡng 0 cho khách mới';
            if (Number(v.mdfCap) < 0) e.mdfCap = 'Không âm';
            return e;
          }}
          onSave={(row, prev) => { setTierRules((p) => (prev ? p.map((t) => (t.tier === prev.tier ? row : t)) : [...p, row])); notify(`Đã lưu hạng ${row.name}`, 'teal'); }}
          onDelete={(r) => { setTierRules((p) => p.filter((t) => t.tier !== r.tier)); notify(`Đã xóa hạng ${r.name}`, 'orange'); }}
          deleteBlocked={(r) => {
            const n = customers.filter((c) => c.tier === r.tier).length;
            if (n) return `Đang có ${n} khách hàng thuộc hạng này. Phân hạng lại trước khi xóa.`;
            if (r.minRevenue === 0) return 'Hạng có ngưỡng 0 dành cho khách mới, không thể xóa.';
            return undefined;
          }}
        />
      </SetBlock>
        </div>
        <TierSuggest />
      </div>
    </div>
  );
}

