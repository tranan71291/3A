'use client';

import { Fragment, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, ChevronDown, ChevronRight, ChevronUp, ClipboardList, Copy, History, Pencil, Play, Plus, Trash2, X } from 'lucide-react';
import { RowMenu } from '../../components/controls';
import { Chip, Field, MoneyInput, SetBlock, SideCard, Table } from '../../components/ui';
import { latestContracts } from '../../lib/business';
import { addDaysISO, bizMode, BOD_WHO, btnGhost, btnPrimary, btnSm, digits, fmtDate, fmtN, inputBase, inputCls, ROLE_LABEL, rowCls, tdCls, tdFirst, tdLast, todayISO, uid, useApp, WF_FIELD_TYPE, WF_FIELDS, WF_OP_LABEL, WF_SLA_OPTS, WF_TEMPLATES, WF_WHO_LABEL, wfCondOk, wfCondText, wfF, wfReasons, wfSlaText, wfStep, wfWhoText } from '../../lib/core';
import type { Role, WfCond, WfDef, WfFieldType, WfOp, WfPolicy, WfStep, WfSubject, WfWhoKind } from '../../lib/types';
import { cn, wfApprovers, wfPath } from '../../lib/utils';
import { Switch } from '../platform/console';

/** Số yêu cầu đang chờ của từng quy trình (đếm theo dữ liệu nghiệp vụ) */
export function useWfPending() {
  const a = useApp();
  return (key: string): number => {
    switch (key) {
      case 'QUOTE': return a.quotes.filter((q) => q.approval?.status === 'PENDING' && q.status !== 'REVISED' && q.status !== 'REJECTED').length;
      case 'CONTRACT': return latestContracts(a.genDocs).filter((d) => d.status === 'PENDING_APPROVAL').length;
      case 'ACTIVITY': return a.activities.filter((x) => x.status === 'PENDING_APPROVAL').length;
      case 'EXPENSE': return a.activities.filter((x) => x.expenseStatus === 'SUBMITTED' || x.expenseStatus === 'HEAD_APPROVED').length;
      case 'PROGRAM': return a.programs.filter((p) => p.status === 'PENDING_INTERNAL').length;
      case 'CLAIM': return a.claims.filter((c) => (!c.submitted && c.proofs.some((x) => x.verification === 'PENDING')) || (c.submitted && !c.vatCheck && !!c.invoice)).length;
      case 'VOUCHER': return a.stockVouchers.filter((v) => v.status === 'PENDING').length + a.salesOrders.filter((o) => o.status === 'PENDING' && !!o.issueRequest).length;
      case 'SALE': return a.salesOrders.filter((o) => o.approval?.status === 'PENDING' && o.status !== 'CANCELLED').length;
      case 'SALE_PAY': return a.salesOrders.reduce((s, o) => s + o.payments.filter((p) => !p.confirmed).length, 0);
      case 'CONTENT': return a.contents.filter((c) => c.status === 'REVIEW').length;
      case 'JOB_QUOTE': return a.jobs.filter((j) => j.quotes[j.quotes.length - 1]?.approval?.status === 'PENDING').length;
      case 'DESIGN': return a.workOrders.filter((w) => w.design?.status === 'REVIEW').length;
      case 'RECEIPT': return a.receipts.filter((r) => r.status === 'SUBMITTED').length;
      default: return a.wfRuns.filter((r) => r.key === key && r.status === 'PENDING').length;
    }
  };
}

export function WorkflowSettings() {
  const app = useApp();
  const { wfAll, setWfDefs, wfPolicy, setWfPolicy, wfDelegations, setWfDelegations, users, me, canDo, notify, company, wfRuns, audit } = app;
  const can = canDo('settings.edit');
  const pending = useWfPending();
  const mode = bizMode(company);
  const [edit, setEdit] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [dg, setDg] = useState<{ fromId: string; toId: string; from: string; to: string; note: string }>({ fromId: '', toId: '', from: todayISO(), to: addDaysISO(todayISO(), 3), note: '' });
  const list = wfAll.filter((d) => !d.mode || mode === 'BOTH' || d.mode === mode);
  if (edit) return <WfEditor defKey={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />;
  const total = list.reduce((s, d) => s + pending(d.key), 0);
  const setDef = (d: WfDef) => setWfDefs((all) => (all.some((x) => x.key === d.key) ? all.map((x) => (x.key === d.key ? d : x)) : [...all, d]));
  const toggle = (d: WfDef, on: boolean) => { setDef({ ...d, enabled: on, updatedAt: Date.now(), updatedBy: me?.id }); audit('WF_TOGGLE', `${on ? 'Bật' : 'Tắt'} quy trình ${d.name}`); };
  const remove = (d: WfDef) => {
    if (wfRuns.some((r) => r.key === d.key && r.status === 'PENDING')) return notify('Còn đề nghị đang chờ duyệt: tắt quy trình thay vì xóa', 'orange');
    const prev = d;
    setWfDefs((all) => all.filter((x) => x.key !== d.key));
    audit('WF_DELETE', `Xóa quy trình ${d.name}`);
    notify(`Đã xóa quy trình ${d.name}`, 'orange', { label: 'Hoàn tác', run: () => setDef(prev) });
  };
  const copy = (d: WfDef) => { const n: WfDef = { ...JSON.parse(JSON.stringify(d)) as WfDef, key: uid('wf'), name: `${d.name} (bản sao)`, builtin: false, lockSteps: false, lockEnable: false, version: 1, history: [], enabled: false }; setDef(n); notify(`Đã tạo bản sao, đang tắt: ${n.name}`, 'teal'); };
  const logs = wfAll.flatMap((d) => (d.history ?? []).map((h) => ({ d, h }))).sort((x, y) => y.h.at - x.h.at).slice(0, 60);
  const pol: [keyof WfPolicy, string, string][] = [
    ['noSelf', 'Không tự duyệt việc của mình', 'Người gửi không duyệt được yêu cầu của chính mình ở mọi bước'],
    ['soleBodSelf', 'Giám đốc duy nhất được tự duyệt', 'Doanh nghiệp chỉ có 1 Giám đốc: tự duyệt, ghi nhật ký bảo mật'],
    ['bodOverride', 'Giám đốc duyệt thay mọi bước', 'Giám đốc thấy và duyệt được mọi yêu cầu đang chờ'],
    ['escalate', 'Quá SLA thì chuyển cấp trên', 'Quá hạn bước: trưởng phòng của người duyệt và Giám đốc cùng duyệt được'],
    ['leaveDelegate', 'Người duyệt nghỉ phép: tự chuyển người thay', 'Có lịch nghỉ cả ngày đã duyệt: trưởng phòng hoặc Giám đốc duyệt thay'],
  ];
  const addDg = () => {
    if (!dg.fromId || !dg.toId || dg.fromId === dg.toId) return notify('Chọn người vắng và người duyệt thay (khác nhau)', 'red');
    if (dg.to < dg.from) return notify('Ngày kết thúc phải sau ngày bắt đầu', 'red');
    setWfDelegations((all) => [{ id: uid('dg'), ...dg, note: dg.note.trim() || undefined, by: me?.id, at: Date.now() }, ...all]);
    audit('WF_DELEGATE', `Ủy quyền duyệt: ${users.find((u) => u.id === dg.fromId)?.name} → ${users.find((u) => u.id === dg.toId)?.name} (${fmtDate(dg.from)}–${fmtDate(dg.to)})`);
    setDg({ ...dg, fromId: '', toId: '', note: '' });
    notify('Đã thêm ủy quyền duyệt', 'teal');
  };
  const today = todayISO();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-medium">Quy trình & phê duyệt</h2>
        <span className="text-[12.5px] text-[rgb(var(--muted))]">{list.length} quy trình · {total} yêu cầu đang chờ</span>
        <span className="ml-auto flex gap-2">
          <button className={cn(btnGhost, btnSm)} onClick={() => setShowLog((v) => !v)} aria-expanded={showLog}><History className="h-3.5 w-3.5" aria-hidden />Nhật ký thay đổi</button>
          {can && <button className={cn(btnPrimary, btnSm)} onClick={() => setEdit('new')}><Plus className="h-3.5 w-3.5" aria-hidden />Tạo quy trình</button>}
        </span>
      </div>
      {showLog && (
        <SetBlock title="Nhật ký thay đổi quy trình" sub={`${logs.length} lần sửa gần nhất`}>
          {logs.length ? <ul className="divide-y divide-[rgb(var(--line))] text-[13px]">{logs.map(({ d, h }) => <li key={`${d.key}-${h.version}-${h.at}`} className="flex flex-wrap gap-x-3 py-2"><span className="font-medium">{d.name}</span><span className="text-[rgb(var(--muted))]">phiên bản {h.version} → {h.version + 1}</span><span className="text-[rgb(var(--fg2))]">{h.note}</span><span className="ml-auto text-[12px] text-[rgb(var(--muted))]">{users.find((u) => u.id === h.by)?.name ?? ''} · {new Date(h.at).toLocaleString('vi-VN')}</span></li>)}</ul> : <p className="text-[13px] text-[rgb(var(--muted))]">Chưa có thay đổi nào.</p>}
        </SetBlock>
      )}
      <SetBlock title="Quy tắc chung" sub="Áp dụng cho mọi quy trình">
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
          {pol.map(([k, t, d]) => (
            <div key={k} className="flex items-start gap-3">
              <Switch on={wfPolicy[k]} disabled={!can} onChange={(v) => { setWfPolicy((p) => ({ ...p, [k]: v })); audit('WF_POLICY', `${v ? 'Bật' : 'Tắt'}: ${t}`); }} label={t} />
              <div><p className="text-[13.5px]">{t}</p><p className="text-[12px] text-[rgb(var(--muted))]">{d}</p></div>
            </div>
          ))}
        </div>
      </SetBlock>
      <SetBlock title="Các quy trình" sub="Bấm tên để sửa người duyệt, điều kiện, SLA" flush>
        <Table head={['Quy trình', 'Khi nào cần duyệt', 'Các bước duyệt', 'SLA bước đầu', <span key="p" className="block text-right">Đang chờ</span>, 'Bật', '']} minW={980}>
          {list.map((d) => {
            const n = pending(d.key);
            return (
              <tr key={d.key} className={rowCls}>
                <td className={tdFirst}><button className="text-left hover:underline" onClick={() => setEdit(d.key)}><span className="block font-medium">{d.name}</span><span className="text-[12px] text-[rgb(var(--muted))]">{d.group}{d.builtin ? '' : ' · tự tạo'} · phiên bản {d.version}</span></button></td>
                <td className={cn(tdCls, 'max-w-[220px] text-[13px] text-[rgb(var(--fg2))]')}>{d.trigger.length ? d.trigger.map((c) => wfCondText(d, c)).join(' hoặc ') : d.triggerText ?? 'Mọi đề nghị'}</td>
                <td className={tdCls}><span className="flex flex-wrap items-center gap-1">{d.steps.map((s, i) => <Fragment key={s.id}>{i > 0 && <ChevronRight className="h-3 w-3 text-[rgb(var(--muted))]" aria-hidden />}<Chip tone={s.when?.length ? 'orange' : 'muted'}>{s.name}{s.when?.length ? ' *' : ''}</Chip></Fragment>)}</span></td>
                <td className={cn(tdCls, 'whitespace-nowrap text-[13px]')}>{d.steps[0] ? wfSlaText(d.steps[0].slaMin) : '—'}</td>
                <td className={cn(tdCls, 'text-right tabular-nums')}>{n ? <Chip tone="orange">{n} chờ</Chip> : <span className="text-[rgb(var(--muted))]">—</span>}</td>
                <td className={tdCls}><Switch on={d.enabled} disabled={!can || !!d.lockEnable} onChange={(v) => toggle(d, v)} label={`Bật ${d.name}`} /></td>
                <td className={tdLast}><RowMenu label={`Thao tác ${d.name}`} items={[
                  { label: can ? 'Sửa quy trình' : 'Xem quy trình', icon: Pencil, onClick: () => setEdit(d.key) },
                  ...(can ? [{ label: 'Nhân bản', icon: Copy, onClick: () => copy(d) }] : []),
                  ...(can && !d.builtin ? [{ label: 'Xóa quy trình', icon: Trash2, danger: true, onClick: () => remove(d) }] : []),
                ]} /></td>
              </tr>
            );
          })}
        </Table>
        <p className="mt-2 text-[12px] text-[rgb(var(--muted))]">* bước có điều kiện. Quy trình có sẵn của hệ thống luôn bật (trừ báo giá, đơn bán, báo giá xưởng); sửa được người duyệt, điều kiện, SLA. Khi cần, Giám đốc vẫn duyệt thay theo quy tắc chung.</p>
      </SetBlock>
      <SetBlock title="Ủy quyền duyệt" sub="Người vắng mặt trong khoảng ngày: người được ủy quyền duyệt thay, ghi rõ duyệt thay ai">
        {can && (
          <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_140px_140px_1fr_auto] md:items-end">
            <Field label="Người vắng"><select className={inputCls} value={dg.fromId} onChange={(e) => setDg({ ...dg, fromId: e.target.value })}><option value="">Chọn người</option>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
            <Field label="Người duyệt thay"><select className={inputCls} value={dg.toId} onChange={(e) => setDg({ ...dg, toId: e.target.value })}><option value="">Chọn người</option>{users.filter((u) => u.active && u.id !== dg.fromId).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
            <Field label="Từ ngày"><input type="date" className={inputCls} value={dg.from} onChange={(e) => setDg({ ...dg, from: e.target.value })} /></Field>
            <Field label="Đến ngày"><input type="date" className={inputCls} value={dg.to} onChange={(e) => setDg({ ...dg, to: e.target.value })} /></Field>
            <Field label="Ghi chú"><input className={inputCls} value={dg.note} onChange={(e) => setDg({ ...dg, note: e.target.value })} placeholder="VD: đi công tác Hãng" /></Field>
            <button className={btnPrimary} onClick={addDg}>Thêm</button>
          </div>
        )}
        {wfDelegations.length ? (
          <ul className="divide-y divide-[rgb(var(--line))] text-[13px]">
            {wfDelegations.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="font-medium">{users.find((u) => u.id === x.fromId)?.name}</span><ArrowRight className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-hidden /><span>{users.find((u) => u.id === x.toId)?.name}</span>
                <span className="text-[rgb(var(--muted))]">{fmtDate(x.from)} – {fmtDate(x.to)}{x.note ? ` · ${x.note}` : ''}</span>
                {x.from <= today && x.to >= today ? <Chip tone="teal">Đang hiệu lực</Chip> : x.to < today ? <Chip tone="muted">Đã hết</Chip> : <Chip tone="blue">Sắp tới</Chip>}
                {can && <button className={cn(btnGhost, btnSm, 'ml-auto')} onClick={() => setWfDelegations((all) => all.filter((y) => y.id !== x.id))}>Gỡ</button>}
              </li>
            ))}
          </ul>
        ) : <p className="text-[13px] text-[rgb(var(--muted))]">Chưa có ủy quyền. Người nghỉ phép cả ngày (lịch nghỉ đã duyệt) tự được trưởng phòng hoặc Giám đốc duyệt thay khi bật quy tắc ở trên.</p>}
      </SetBlock>
    </div>
  );
}

/** Ô điều kiện: trường · so sánh · giá trị */
export function WfCondsEditor({ def, conds, onChange, ro, fields }: { def: WfDef; conds: WfCond[]; onChange: (c: WfCond[]) => void; ro: boolean; fields: { id: string; label: string; unit?: string }[] }) {
  if (!fields.length) return <p className="text-[12.5px] text-[rgb(var(--muted))]">Quy trình này không có trường số để đặt điều kiện.</p>;
  return (
    <div className="space-y-2">
      {conds.map((c, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-[rgb(var(--ink)/0.04)] px-2.5 py-2">
          {i > 0 && <span className="text-[12px] font-medium text-[rgb(var(--muted))]">HOẶC</span>}
          <select className={cn(inputBase, 'py-1 text-[13px]')} disabled={ro} value={c.field} onChange={(e) => onChange(conds.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))} aria-label="Trường">{fields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
          <select className={cn(inputBase, 'py-1 text-[13px]')} disabled={ro} value={c.op} onChange={(e) => onChange(conds.map((x, j) => (j === i ? { ...x, op: e.target.value as WfOp } : x)))} aria-label="So sánh">{(Object.keys(WF_OP_LABEL) as WfOp[]).map((o) => <option key={o} value={o}>{WF_OP_LABEL[o]}</option>)}</select>
          {c.op !== 'empty' && <input className={cn(inputBase, 'w-36 py-1 text-right text-[13px] tabular-nums')} disabled={ro} inputMode="decimal" value={c.value === undefined ? '' : fields.find((f) => f.id === c.field)?.unit === 'đ' ? fmtN(Number(c.value)) : String(c.value)} onChange={(e) => { const raw = e.target.value; const v = fields.find((f) => f.id === c.field)?.unit === 'đ' ? digits(raw) : Number(raw.replace(',', '.')); onChange(conds.map((x, j) => (j === i ? { ...x, value: Number.isFinite(v) ? v : 0 } : x))); }} aria-label="Giá trị" />}
          <span className="text-[12px] text-[rgb(var(--muted))]">{fields.find((f) => f.id === c.field)?.unit === '%' ? '%' : fields.find((f) => f.id === c.field)?.unit === 'đ' ? 'đ' : ''}</span>
          {!ro && <button className="ml-auto rounded p-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => onChange(conds.filter((_, j) => j !== i))} aria-label="Xóa điều kiện"><X className="h-3.5 w-3.5" aria-hidden /></button>}
        </div>
      ))}
      {!ro && <button className={cn(btnGhost, btnSm)} onClick={() => onChange([...conds, { field: fields[0].id, op: 'gt', value: 0 }])}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm điều kiện</button>}
      {!conds.length && <p className="text-[12px] text-[rgb(var(--muted))]">Không có điều kiện: {def.builtin ? 'mọi yêu cầu' : 'mọi đề nghị'} đều đi qua bước này.</p>}
    </div>
  );
}

export function WfEditor({ defKey, onClose }: { defKey?: string; onClose: () => void }) {
  const app = useApp();
  const { wfAll, setWfDefs, users, departments, me, canDo, notify, audit, wfCtx } = app;
  const ro = !canDo('settings.edit');
  const src = defKey ? wfAll.find((d) => d.key === defKey) : undefined;
  const blank: WfDef = { key: uid('wf'), name: '', group: 'Hành chính & tài sản', enabled: true, version: 1, trigger: [], steps: [wfStep(uid('st'), 'Quản lý trực tiếp duyệt', { kind: 'MANAGER' }, 480)], form: [wfF('title', 'Tiêu đề đề nghị', 'TEXT', true)], prefix: 'DN', after: ['NOTIFY'] };
  const [d, setD] = useState<WfDef>(() => JSON.parse(JSON.stringify(src ?? blank)) as WfDef);
  const [note, setNote] = useState('');
  const custom = !d.builtin;
  const numFields = custom ? (d.form ?? []).filter((f) => f.type === 'NUMBER' || f.type === 'MONEY').map((f) => ({ id: f.id, label: f.label, unit: f.type === 'MONEY' ? 'đ' : undefined })) : WF_FIELDS[d.key] ?? [];
  const set = (p: Partial<WfDef>) => setD((x) => ({ ...x, ...p }));
  const setStep = (i: number, p: Partial<WfStep>) => set({ steps: d.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const move = <T,>(arr: T[], i: number, dir: -1 | 1) => { const a = arr.slice(); const j = i + dir; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; };
  // ---- chạy thử
  const [simReq, setSimReq] = useState(users.find((u) => u.active && u.role === 'SALES_REP')?.id ?? me?.id ?? '');
  const [simDept, setSimDept] = useState('');
  const [simVals, setSimVals] = useState<Record<string, string>>({});
  const reqU = users.find((u) => u.id === simReq);
  const sim: WfSubject = { requesterId: simReq, dept: simDept || reqU?.dept, amount: simVals.amount ? Number(simVals.amount) : numFields.find((f) => f.unit === 'đ') ? Number(simVals[numFields.find((f) => f.unit === 'đ')!.id] ?? 0) || undefined : undefined, vals: Object.fromEntries(numFields.map((f) => [f.id, simVals[f.id] === undefined || simVals[f.id] === '' ? null : Number(simVals[f.id])])) };
  const simNeeds = !d.trigger.length || d.trigger.some((c) => wfCondOk(c, sim));
  const simPath = wfPath(d, sim);
  const ctx = { ...wfCtx(), me: undefined };
  const errs: string[] = [];
  if (!d.name.trim()) errs.push('Nhập tên quy trình');
  if (!d.steps.length) errs.push('Cần ít nhất một bước duyệt');
  if (d.steps.some((s) => !s.name.trim())) errs.push('Bước duyệt chưa có tên');
  if (d.steps.some((s) => s.who.kind === 'USER' && !s.who.userId)) errs.push('Bước "Người cụ thể" chưa chọn người');
  if (custom && !(d.form ?? []).length) errs.push('Biểu mẫu cần ít nhất một trường');
  if (custom && (d.form ?? []).some((f) => !f.label.trim())) errs.push('Trường biểu mẫu chưa có tên');
  if (custom && (d.after ?? []).includes('CASH_OUT') && !(d.form ?? []).some((f) => f.type === 'MONEY')) errs.push('Tự sinh phiếu chi cần một trường kiểu Số tiền');
  const save = () => {
    if (ro) return;
    if (errs.length) return notify(errs[0], 'red');
    const changed = !src || JSON.stringify({ s: src.steps, t: src.trigger, f: src.form, a: src.after, n: src.name }) !== JSON.stringify({ s: d.steps, t: d.trigger, f: d.form, a: d.after, n: d.name });
    const out: WfDef = src && changed
      ? { ...d, version: src.version + 1, updatedAt: Date.now(), updatedBy: me?.id, history: [...(src.history ?? []), { version: src.version, at: Date.now(), by: me?.id, note: note.trim() || 'Sửa quy trình', steps: src.steps, trigger: src.trigger }].slice(-30) }
      : { ...d, updatedAt: Date.now(), updatedBy: me?.id };
    setWfDefs((all) => (all.some((x) => x.key === out.key) ? all.map((x) => (x.key === out.key ? out : x)) : [...all, out]));
    audit('WF_CHANGE', `${src ? 'Sửa' : 'Tạo'} quy trình ${out.name}${src && changed ? ` (phiên bản ${out.version})` : ''}`);
    notify(src ? (changed ? `Đã lưu ${out.name} phiên bản ${out.version}. Yêu cầu đã duyệt dở giữ phiên bản cũ` : 'Đã lưu') : `Đã tạo quy trình ${out.name}`, 'teal');
    onClose();
  };
  const applyTpl = (t: (typeof WF_TEMPLATES)[number] | null) => setD((x) => (t ? { ...x, ...JSON.parse(JSON.stringify(t)) as Partial<WfDef>, key: x.key, version: 1, enabled: true } : { ...blank, key: x.key }));
  const whoSel = (s: WfStep, i: number) => (
    <div className="grid grid-cols-1 gap-2 sm:auto-cols-fr sm:grid-flow-col">
      <select className={inputCls} disabled={ro} value={s.who.kind} onChange={(e) => setStep(i, { who: { kind: e.target.value as WfWhoKind, role: e.target.value === 'ROLE' ? s.who.role ?? 'BOD' : undefined, userId: undefined } })} aria-label="Người duyệt">
        {(Object.keys(WF_WHO_LABEL) as WfWhoKind[]).map((k) => <option key={k} value={k}>{WF_WHO_LABEL[k]}</option>)}
      </select>
      {s.who.kind === 'ROLE' && <select className={inputCls} disabled={ro} value={s.who.role} onChange={(e) => setStep(i, { who: { kind: 'ROLE', role: e.target.value as Role } })} aria-label="Vai trò">{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>}
      {s.who.kind === 'USER' && <select className={inputCls} disabled={ro} value={s.who.userId ?? ''} onChange={(e) => setStep(i, { who: { kind: 'USER', userId: e.target.value } })} aria-label="Người duyệt cụ thể"><option value="">Chọn người</option>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role]}</option>)}</select>}
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className={cn(btnGhost, btnSm)} onClick={onClose}><ArrowLeft className="h-3.5 w-3.5" aria-hidden />Quy trình</button>
        <h2 className="text-[15px] font-medium">{src ? d.name || 'Quy trình' : 'Tạo quy trình mới'}</h2>
        {src && <Chip tone={d.enabled ? 'teal' : 'muted'}>{d.enabled ? 'Đang dùng' : 'Đang tắt'} · phiên bản {src.version}</Chip>}
        <span className="ml-auto flex gap-2">
          <button className={btnGhost} onClick={onClose}>Hủy</button>
          {!ro && <button className={btnPrimary} onClick={save}>{src ? `Lưu${JSON.stringify(src.steps) !== JSON.stringify(d.steps) || JSON.stringify(src.trigger) !== JSON.stringify(d.trigger) ? ` phiên bản ${src.version + 1}` : ''}` : 'Tạo và bật'}</button>}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          {custom && (
            <SetBlock title="Thông tin">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Tên quy trình *"><input className={inputCls} disabled={ro} value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="VD: Đề nghị mua tài sản" /></Field>
                <Field label="Nhóm"><input className={inputCls} disabled={ro} value={d.group} onChange={(e) => set({ group: e.target.value })} /></Field>
                <Field label="Tiền tố mã đề nghị"><input className={inputCls} disabled={ro} value={d.prefix ?? ''} onChange={(e) => set({ prefix: e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) })} placeholder="TS" /></Field>
                <Field label="Mô tả cho người gửi" className="md:col-span-2"><input className={inputCls} disabled={ro} value={d.desc ?? ''} onChange={(e) => set({ desc: e.target.value })} /></Field>
                <Field label="Ai được gửi đề nghị"><div className="flex flex-wrap gap-x-3 gap-y-1 pt-1.5">{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <label key={r} className="flex items-center gap-1.5 text-[12.5px]"><input type="checkbox" disabled={ro} checked={!d.submitRoles?.length || d.submitRoles.includes(r)} onChange={(e) => { const cur = d.submitRoles?.length ? d.submitRoles : (Object.keys(ROLE_LABEL) as Role[]); const next = e.target.checked ? [...cur, r] : cur.filter((x) => x !== r); set({ submitRoles: next.length === Object.keys(ROLE_LABEL).length ? [] : next }); }} />{ROLE_LABEL[r]}</label>)}</div></Field>
              </div>
            </SetBlock>
          )}
          {custom && (
            <SetBlock title="Biểu mẫu đề nghị" sub={`${(d.form ?? []).length} trường`} action={!ro && <button className={cn(btnGhost, btnSm)} onClick={() => set({ form: [...(d.form ?? []), wfF(uid('f'), '', 'TEXT')] })}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm trường</button>}>
              <div className="space-y-2">
                {(d.form ?? []).map((f, i) => (
                  <div key={f.id} className="grid grid-cols-[auto_1fr_150px_auto_auto] items-center gap-2 border-t border-[rgb(var(--line))] pt-2 first:border-0 first:pt-0">
                    <span className="flex flex-col"><button className="text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] disabled:opacity-30" disabled={ro || i === 0} onClick={() => set({ form: move(d.form ?? [], i, -1) })} aria-label={`Đưa ${f.label} lên`}><ChevronUp className="h-3.5 w-3.5" aria-hidden /></button><button className="text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] disabled:opacity-30" disabled={ro || i === (d.form ?? []).length - 1} onClick={() => set({ form: move(d.form ?? [], i, 1) })} aria-label={`Đưa ${f.label} xuống`}><ChevronDown className="h-3.5 w-3.5" aria-hidden /></button></span>
                    <div className="min-w-0"><input className={inputCls} disabled={ro} value={f.label} onChange={(e) => set({ form: (d.form ?? []).map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Tên trường" aria-label="Tên trường" />
                      {(f.type === 'SELECT' || f.type === 'MULTI') && <input className={cn(inputCls, 'mt-1 text-[12.5px]')} disabled={ro} value={(f.options ?? []).join(', ')} onChange={(e) => set({ form: (d.form ?? []).map((x, j) => (j === i ? { ...x, options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) } : x)) })} placeholder="Các lựa chọn, cách nhau bằng dấu phẩy" aria-label="Lựa chọn" />}</div>
                    <select className={inputCls} disabled={ro} value={f.type} onChange={(e) => set({ form: (d.form ?? []).map((x, j) => (j === i ? { ...x, type: e.target.value as WfFieldType } : x)) })} aria-label="Kiểu trường">{(Object.keys(WF_FIELD_TYPE) as WfFieldType[]).map((t) => <option key={t} value={t}>{WF_FIELD_TYPE[t]}</option>)}</select>
                    <label className="flex items-center gap-1.5 whitespace-nowrap text-[12.5px]"><input type="checkbox" disabled={ro} checked={!!f.required} onChange={(e) => set({ form: (d.form ?? []).map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)) })} />Bắt buộc</label>
                    <button className="rounded p-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))] disabled:opacity-30" disabled={ro} onClick={() => set({ form: (d.form ?? []).filter((_, j) => j !== i) })} aria-label={`Xóa trường ${f.label}`}><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-[rgb(var(--muted))]">Kiểu trường: {Object.values(WF_FIELD_TYPE).join(' · ')}. Trường Số / Số tiền dùng được trong điều kiện.</p>
            </SetBlock>
          )}
          <SetBlock title="Khi nào cần duyệt" sub={d.triggerText ? 'Điều kiện cố định của hệ thống' : 'Khớp một trong các điều kiện thì cần duyệt; không khớp thì tự duyệt'}>
            {d.triggerText && !d.trigger.length ? <p className="text-[13px]">{d.triggerText}</p> : <WfCondsEditor def={d} conds={d.trigger} onChange={(c) => set({ trigger: c })} ro={ro} fields={numFields} />}
            {d.skipText && <p className="mt-2 text-[12.5px] text-[rgb(var(--muted))]">Bỏ qua: {d.skipText}</p>}
          </SetBlock>
          <SetBlock title="Các bước duyệt" sub={d.lockSteps ? 'Số bước cố định theo nghiệp vụ; sửa được người duyệt, SLA' : 'Thêm, bớt, đổi thứ tự; bước có điều kiện chỉ chạy khi khớp'}>
            <ol className="space-y-3">
              {d.steps.map((s, i) => (
                <li key={s.id} className="grid grid-cols-[28px_1fr] gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[rgb(var(--fg))] text-[12px] text-[rgb(var(--bg))]">{i + 1}</span>
                  <div className="rounded-lg border border-[rgb(var(--line))] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input className={cn(inputBase, 'min-w-[200px] flex-1 py-1.5 font-medium')} disabled={ro} value={s.name} onChange={(e) => setStep(i, { name: e.target.value })} aria-label={`Tên bước ${i + 1}`} />
                      <Chip tone={s.when?.length ? 'orange' : 'blue'}>{s.when?.length ? 'Có điều kiện' : 'Bắt buộc'}</Chip>
                      {!ro && !d.lockSteps && <>
                        <button className="rounded p-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] disabled:opacity-30" disabled={i === 0} onClick={() => set({ steps: move(d.steps, i, -1) })} aria-label={`Đưa bước ${i + 1} lên`}><ChevronUp className="h-4 w-4" aria-hidden /></button>
                        <button className="rounded p-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] disabled:opacity-30" disabled={i === d.steps.length - 1} onClick={() => set({ steps: move(d.steps, i, 1) })} aria-label={`Đưa bước ${i + 1} xuống`}><ChevronDown className="h-4 w-4" aria-hidden /></button>
                        <button className="rounded p-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))] disabled:opacity-30" disabled={d.steps.length <= 1} onClick={() => set({ steps: d.steps.filter((_, j) => j !== i) })} aria-label={`Xóa bước ${i + 1}`}><Trash2 className="h-4 w-4" aria-hidden /></button>
                      </>}
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">
                      <div className="sm:col-span-2 xl:col-span-1"><Field label="Người duyệt">{whoSel(s, i)}</Field></div>
                      <Field label="SLA"><select className={inputCls} disabled={ro} value={s.slaMin} onChange={(e) => setStep(i, { slaMin: Number(e.target.value) })}>{WF_SLA_OPTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></Field>
                      <Field label="Hạn mức bước" hint="Vượt thì thêm Giám đốc"><MoneyInput value={s.limit ?? 0} disabled={ro} onChange={(n) => setStep(i, { limit: n || undefined })} /></Field>
                      <Field label="Quá hạn"><select className={inputCls} disabled={ro} value={s.overdue ?? 'ESCALATE'} onChange={(e) => setStep(i, { overdue: e.target.value as 'REMIND' | 'ESCALATE' })}><option value="ESCALATE">Chuyển cấp trên</option><option value="REMIND">Chỉ đánh dấu quá hạn</option></select></Field>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px]">
                      <label className="flex items-center gap-1.5"><input type="checkbox" disabled={ro} checked={s.allowNeedInfo !== false} onChange={(e) => setStep(i, { allowNeedInfo: e.target.checked })} />Cho yêu cầu bổ sung</label>
                      <label className="flex items-center gap-1.5"><input type="checkbox" disabled={ro} checked={!!s.userLimit} onChange={(e) => setStep(i, { userLimit: e.target.checked })} />Người duyệt phải đủ hạn mức cá nhân</label>
                      {!d.lockSteps && <label className="flex items-center gap-1.5"><input type="checkbox" disabled={ro || !numFields.length} checked={!!s.when?.length} onChange={(e) => setStep(i, { when: e.target.checked ? [{ field: numFields[0]?.id ?? 'amount', op: 'gt', value: 0 }] : undefined })} />Chỉ chạy khi…</label>}
                      <span className="text-[rgb(var(--muted))]">Từ chối luôn bắt buộc nhập lý do</span>
                    </div>
                    {!!s.when?.length && <div className="mt-2"><WfCondsEditor def={d} conds={s.when} onChange={(c) => setStep(i, { when: c.length ? c : undefined })} ro={ro} fields={numFields} /></div>}
                  </div>
                </li>
              ))}
            </ol>
            {!ro && !d.lockSteps && <button className={cn(btnGhost, 'mt-3 w-full justify-center border-dashed')} onClick={() => set({ steps: [...d.steps, wfStep(uid('st'), 'Giám đốc duyệt', BOD_WHO, 1440)] })}><Plus className="h-4 w-4" aria-hidden />Thêm bước duyệt</button>}
          </SetBlock>
          {custom && (
            <SetBlock title="Sau khi duyệt xong">
              <div className="space-y-2 text-[13px]">
                <label className="flex items-center gap-2"><input type="checkbox" checked disabled />Báo người gửi (thông báo trong CRM, Zalo / email theo cài đặt thông báo)</label>
                <label className="flex items-center gap-2"><input type="checkbox" disabled={ro} checked={(d.after ?? []).includes('CASH_OUT')} onChange={(e) => set({ after: e.target.checked ? [...(d.after ?? []), 'CASH_OUT'] : (d.after ?? []).filter((x) => x !== 'CASH_OUT') })} />Tự sinh phiếu chi theo trường Số tiền (sổ quỹ ngân hàng)</label>
                <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2"><input type="checkbox" disabled={ro} checked={(d.after ?? []).includes('NOTIFY_USER')} onChange={(e) => set({ after: e.target.checked ? [...(d.after ?? []), 'NOTIFY_USER'] : (d.after ?? []).filter((x) => x !== 'NOTIFY_USER') })} />Báo thêm cho</label>
                  <select className={cn(inputBase, 'py-1 text-[13px]')} disabled={ro || !(d.after ?? []).includes('NOTIFY_USER')} value={d.notifyUserId ?? ''} onChange={(e) => set({ notifyUserId: e.target.value || undefined })} aria-label="Người được báo"><option value="">Chọn người</option>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                <p className="text-[12px] text-[rgb(var(--muted))]">Đề nghị đã duyệt in được phiếu có tên người duyệt từng bước.</p>
              </div>
            </SetBlock>
          )}
          {src && !ro && <Field label="Ghi chú thay đổi (lưu vào nhật ký)"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: thêm Giám đốc duyệt đơn trên 2 tỷ" /></Field>}
          {errs.length > 0 && !ro && <p className="text-[12.5px] text-[rgb(var(--danger-fg))]">{errs[0]}</p>}
        </div>
        <div className="space-y-4">
          {!src && (
            <SideCard title="Bắt đầu từ mẫu có sẵn" icon={ClipboardList}>
              <div className="grid gap-2">
                {WF_TEMPLATES.map((t) => <button key={t.name} className={cn('rounded-lg border px-3 py-2 text-left text-[13px] hover:bg-[rgb(var(--ink)/0.03)]', d.name === t.name ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.06)]' : 'border-[rgb(var(--line))]')} onClick={() => applyTpl(t)}><span className="block font-medium">{t.name}</span><span className="text-[12px] text-[rgb(var(--muted))]">{t.steps.map((s) => s.name).join(' → ')}</span></button>)}
                <button className="rounded-lg border border-[rgb(var(--line))] px-3 py-2 text-left text-[13px] hover:bg-[rgb(var(--ink)/0.03)]" onClick={() => applyTpl(null)}><span className="block font-medium">Trống</span><span className="text-[12px] text-[rgb(var(--muted))]">Tự tạo từ đầu</span></button>
              </div>
            </SideCard>
          )}
          <SideCard title="Chạy thử quy trình" icon={Play} sub="Nhập số liệu giả định, xem đi qua bước nào, ai duyệt">
            <div className="grid grid-cols-2 gap-2">
              {numFields.map((f) => <Field key={f.id} label={`${f.label}${f.unit ? ` (${f.unit})` : ''}`}><input className={inputCls} inputMode="decimal" value={simVals[f.id] ?? ''} onChange={(e) => setSimVals({ ...simVals, [f.id]: e.target.value.replace(/[^\d.-]/g, '') })} /></Field>)}
              <Field label="Người gửi"><select className={inputCls} value={simReq} onChange={(e) => setSimReq(e.target.value)}>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
              <Field label="Phòng của khách / dự án"><select className={inputCls} value={simDept} onChange={(e) => setSimDept(e.target.value)}><option value="">Theo người gửi</option>{departments.filter((x) => x.active).map((x) => <option key={x.code} value={x.code}>{x.short}</option>)}</select></Field>
            </div>
            <ol className="mt-3 space-y-2 text-[13px]">
              <li className="flex gap-2"><span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', simNeeds ? 'bg-[rgb(var(--accent))]' : 'bg-[rgb(var(--ok))]')} /><div>{simNeeds ? 'Cần duyệt' : 'Không cần duyệt, tự hoàn tất'}<span className="block text-[12px] text-[rgb(var(--muted))]">{simNeeds ? (d.trigger.length ? wfReasons(d, sim).join('; ') || 'mọi yêu cầu' : d.triggerText ?? 'mọi đề nghị') : 'không khớp điều kiện nào'}</span></div></li>
              {simNeeds && simPath.map((s, i) => { const who = wfApprovers(s, sim, ctx); return <li key={`${s.id}-${i}`} className="flex gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: '#1f74d4' }} /><div>Bước {i + 1} · {who.map((x) => `${x.u.name}${x.onBehalf ? ` (thay ${x.onBehalf.name})` : ''}`).join(', ') || '—'}<span className="block text-[12px] text-[rgb(var(--muted))]">{s.name} · {wfWhoText(s.who, users)} · SLA {wfSlaText(s.slaMin)}</span></div></li>; })}
              {simNeeds && <li className="text-[12px] text-[rgb(var(--muted))]">Tổng SLA tối đa {wfSlaText(simPath.reduce((a, s) => a + s.slaMin, 0))}</li>}
            </ol>
          </SideCard>
          <SideCard title="Lưu ý khi sửa" icon={AlertTriangle}>
            <ul className="list-disc space-y-1 pl-4 text-[13px] text-[rgb(var(--fg2))]">
              <li>Yêu cầu đã có người duyệt bước đầu giữ các bước của phiên bản cũ</li>
              <li>Yêu cầu chưa ai duyệt và yêu cầu mới dùng phiên bản mới sau khi lưu</li>
              <li>Không có người phù hợp ở một bước (vd phòng chưa có trưởng phòng) thì Giám đốc duyệt</li>
              <li>Báo giá điều chỉnh tự rời hàng chờ của bản cũ</li>
            </ul>
          </SideCard>
        </div>
      </div>
    </div>
  );
}

