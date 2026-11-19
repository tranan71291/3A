'use client';

import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, Eye, Paperclip, Pencil, Printer, Send, Undo2, Upload, X } from 'lucide-react';
import { RowMenu, useSelection } from '../../components/controls';
import { Chip, Code, EmptyState, Field, FilePicker, MoneyInput, SetBlock, SideCard, Table } from '../../components/ui';
import { btnGhost, btnPrimary, btnSm, DECISION_LABEL, esc, fmtN, fold, inputBase, inputCls, rowCls, RUN_STATUS, runStep, runVal, tdCls, tdFirst, tdLast, todayISO, useApp, vnd, WF_DEFAULTS, wfAmountOf, wfCondOk, wfCondText, wfFormVals, wfNeeds, wfSlaText } from '../../lib/core';
import { downloadCsv } from '../../lib/csv';
import type { CompanyInfo, User, WfDef, WfRun, WfSubject } from '../../lib/types';
import { cn, wfApprovers, wfPath } from '../../lib/utils';
import { compressImage } from '../../lib/workshop';
import { SearchBox } from '../alux/orders';
import { docShell, printHtml } from '../sales/templates';
import { useHubItem } from './tasks';

export function requestHtml(r: WfRun, d: WfDef, users: User[], company: CompanyInfo) {
  const rows = (d.form ?? []).filter((f) => f.type !== 'FILE').map((f) => `<tr><td style="width:35%">${esc(f.label)}</td><td>${esc(runVal(f, r.form?.[f.id], users))}</td></tr>`).join('');
  const steps = r.steps.map((s, i) => { const dec = r.decisions.filter((x) => x.step === i).slice(-1)[0]; return `<tr><td>${i + 1}. ${esc(s.name)}</td><td>${dec ? `${esc(users.find((u) => u.id === dec.by)?.name ?? '')} · ${DECISION_LABEL[dec.decision].label} · ${new Date(dec.at).toLocaleString('vi-VN')}${dec.note ? ` · ${esc(dec.note)}` : ''}` : 'Chưa duyệt'}</td></tr>`; }).join('');
  return `<p><b>${esc(company.legalName)}</b></p><h1>${esc(d.name.toUpperCase())}</h1><p class="c">Số ${esc(r.code ?? '')} · ngày ${new Date(r.startedAt).toLocaleDateString('vi-VN')}</p>
<p>Người đề nghị: <b>${esc(users.find((u) => u.id === r.requesterId)?.name ?? '')}</b></p>
<table class="items"><tbody>${rows}</tbody></table><p><b>Quá trình duyệt</b></p><table class="items"><tbody>${steps}</tbody></table>
<table class="layout sign"><tr><td><b>NGƯỜI ĐỀ NGHỊ</b><br><br><br><br>${esc(users.find((u) => u.id === r.requesterId)?.name ?? '')}</td><td><b>NGƯỜI DUYỆT</b><br><br><br><br>${esc(users.find((u) => u.id === r.decisions[r.decisions.length - 1]?.by)?.name ?? '')}</td></tr></table>`;
}

export function RequestsPanel() {
  const app = useApp();
  const { wfAll, wfRuns, me, role, users, reqOpen, setReqOpen, canDo, go } = app;
  const defs = wfAll.filter((d) => !d.builtin && d.enabled && (!d.submitRoles?.length || d.submitRoles.includes(role)));
  const [pick, setPick] = useState<string | null>(null);
  const [redo, setRedo] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const hubOf = useHubItem();
  const mine0 = wfRuns.filter((r) => r.requesterId === me.id && !WF_DEFAULTS.some((d) => d.key === r.key));
  const sel = useSelection(mine0.map((r) => r.id));
  const open = reqOpen ? wfRuns.find((r) => r.id === reqOpen) : undefined;
  if (open) return <RequestDetail r={open} onBack={() => setReqOpen(null)} onEdit={() => { setReqOpen(null); setRedo(open.id); setPick(null); }} />;
  const redoRun = redo ? wfRuns.find((r) => r.id === redo) : undefined;
  const formDef = redoRun ? app.wfDef(redoRun.key) : pick ? app.wfDef(pick) : undefined;
  const key = fold(q.trim());
  const mine = mine0.filter((r) => !key || fold(`${r.code} ${r.title}`).includes(key)).sort((a, b) => b.startedAt - a.startedAt);
  const toMe = wfRuns.filter((r) => r.status === 'PENDING' && !WF_DEFAULTS.some((d) => d.key === r.key) && !!hubOf('REQUEST', r.id));
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_400px]">
      <div className="min-w-0 space-y-4">
        <SetBlock title="Tạo đề nghị" sub={defs.length ? `${defs.length} loại đề nghị` : undefined} action={canDo('settings.edit') ? <button className={cn(btnGhost, btnSm)} onClick={() => go('settings')}>Quản lý quy trình</button> : undefined}>
          {defs.length ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {defs.map((d) => (
                <button key={d.key} className={cn('rounded-lg border px-3 py-2.5 text-left hover:bg-[rgb(var(--ink)/0.03)]', pick === d.key && !redo ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.06)]' : 'border-[rgb(var(--line))]')} onClick={() => { setPick(d.key); setRedo(null); }}>
                  <span className="block text-[13.5px] font-medium">{d.name}</span>
                  <span className="text-[12px] text-[rgb(var(--muted))]">{d.group} · ~{wfSlaText(d.steps.reduce((s, x) => s + x.slaMin, 0))}</span>
                </button>
              ))}
              <button className="rounded-lg border border-[rgb(var(--line))] px-3 py-2.5 text-left hover:bg-[rgb(var(--ink)/0.03)]" onClick={() => go('staff')}><span className="block text-[13.5px] font-medium">Nghỉ phép / công tác</span><span className="text-[12px] text-[rgb(var(--muted))]">Lịch công tác · quy trình có sẵn</span></button>
            </div>
          ) : <EmptyState compact text="Chưa có loại đề nghị nào" hint={canDo('settings.edit') ? 'Tạo ở Cài đặt › Quy trình & phê duyệt › Tạo quy trình (có 5 mẫu sẵn).' : 'Quản trị viên tạo quy trình đề nghị ở Cài đặt.'} art="doc" action={canDo('settings.edit') ? 'Tạo quy trình' : undefined} onAction={() => go('settings')} />}
        </SetBlock>
        {toMe.length > 0 && (
          <SetBlock title="Chờ tôi duyệt" sub={`${toMe.length} đề nghị`}>
            <ul className="divide-y divide-[rgb(var(--line))] text-[13px]">
              {toMe.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"><Code>{r.code}</Code><button className="font-medium hover:underline" onClick={() => setReqOpen(r.id)}>{r.title}</button><span className="text-[rgb(var(--muted))]">{users.find((u) => u.id === r.requesterId)?.name}{r.amount ? ` · ${vnd(r.amount)}` : ''} · bước {runStep(r) + 1}/{r.steps.length}</span><span className="ml-auto flex gap-1.5"><button className={cn(btnGhost, btnSm)} onClick={() => hubOf('REQUEST', r.id)?.approve?.()}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />Duyệt</button><button className={cn(btnGhost, btnSm)} onClick={() => setReqOpen(r.id)}>Xem</button></span></li>)}
            </ul>
          </SetBlock>
        )}
        <SetBlock title="Đề nghị của tôi" sub={`${mine.length} đề nghị`} flush action={<SearchBox value={q} onChange={setQ} placeholder="Tìm mã, nội dung" />}>
          {sel.ids.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-[rgb(var(--ink)/0.04)] px-3 py-2 text-[13px]">
              <span>Đã chọn {sel.ids.length}</span>
              <button className={cn(btnGhost, btnSm)} onClick={() => downloadCsv(`de-nghi-${todayISO()}.csv`, [['Mã', 'Nội dung', 'Loại', 'Số tiền', 'Trạng thái', 'Ngày gửi'], ...mine.filter((r) => sel.has(r.id)).map((r) => [r.code ?? '', r.title ?? '', app.wfDef(r.key)?.name ?? '', r.amount ?? '', RUN_STATUS[r.status].label, new Date(r.startedAt).toLocaleDateString('vi-VN')])])}><Download className="h-3.5 w-3.5" aria-hidden />Xuất CSV</button>
              <button className={cn(btnGhost, btnSm)} onClick={() => { const ids = mine.filter((r) => sel.has(r.id) && r.status === 'PENDING' && !r.decisions.length).map((r) => r.id); app.setWfRuns((all) => all.map((r) => (ids.includes(r.id) ? { ...r, status: 'CANCELLED', doneAt: Date.now() } : r))); sel.clear(); app.notify(ids.length ? `Đã rút ${ids.length} đề nghị` : 'Chỉ rút được đề nghị chưa ai duyệt', ids.length ? 'teal' : 'orange'); }}>Rút lại</button>
              <button className={cn(btnGhost, btnSm, 'ml-auto')} onClick={() => sel.clear()}>Bỏ chọn</button>
            </div>
          )}
          <Table head={[<input key="all" type="checkbox" className="h-4 w-4" checked={sel.allOn} onChange={() => sel.toggleAll()} aria-label="Chọn tất cả" />, 'Mã', 'Nội dung', 'Loại', <span key="a" className="block text-right">Số tiền</span>, 'Đang ở bước', 'Trạng thái', '']} minW={860} stt={false}>
            {mine.map((r) => {
              const i = runStep(r);
              return (
                <tr key={r.id} className={cn(rowCls, sel.has(r.id) && 'bg-[rgb(var(--accent)/0.05)]')}>
                  <td className={cn(tdFirst, 'w-10')}><input type="checkbox" className="h-4 w-4" checked={sel.has(r.id)} onChange={() => sel.toggle(r.id)} aria-label={`Chọn ${r.code}`} /></td>
                  <td className={tdCls}><Code>{r.code}</Code></td>
                  <td className={tdCls}><button className="max-w-[260px] truncate text-left hover:underline" onClick={() => setReqOpen(r.id)}>{r.title}</button></td>
                  <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{app.wfDef(r.key)?.name ?? ''}</td>
                  <td className={cn(tdCls, 'text-right tabular-nums')}>{r.amount ? fmtN(r.amount) : '—'}</td>
                  <td className={cn(tdCls, 'text-[13px]')}>{r.status === 'PENDING' ? `${i + 1}/${r.steps.length} · ${r.steps[i]?.name ?? ''}` : r.status === 'APPROVED' ? 'Xong' : '—'}</td>
                  <td className={tdCls}><Chip tone={RUN_STATUS[r.status].tone}>{RUN_STATUS[r.status].label}</Chip></td>
                  <td className={tdLast}><RowMenu label={`Thao tác ${r.code}`} items={[
                    { label: 'Xem chi tiết', icon: Eye, onClick: () => setReqOpen(r.id) },
                    ...(r.status === 'NEED_INFO' || r.status === 'REJECTED' ? [{ label: 'Sửa và gửi lại', icon: Pencil, onClick: () => { setRedo(r.id); setPick(null); } }] : []),
                    ...(r.status === 'PENDING' && !r.decisions.length ? [{ label: 'Rút lại', icon: Undo2, onClick: () => app.setWfRuns((all) => all.map((x) => (x.id === r.id ? { ...x, status: 'CANCELLED', doneAt: Date.now() } : x))) }] : []),
                    { label: 'In phiếu đề nghị', icon: Printer, onClick: () => { const d = app.wfDef(r.key); if (d) printHtml(docShell(`${d.name} ${r.code}`, requestHtml(r, d, users, app.company))); } },
                  ]} /></td>
                </tr>
              );
            })}
          </Table>
          {!mine.length && <EmptyState compact text="Bạn chưa gửi đề nghị nào" art="inbox" />}
        </SetBlock>
      </div>
      <div>{formDef ? <RequestForm key={`${formDef.key}-${redo ?? 'new'}`} def={formDef} run={redoRun} onDone={() => { setPick(null); setRedo(null); }} /> : <SideCard title="Gửi đề nghị" icon={Send}><p className="text-[13px] text-[rgb(var(--fg2))]">Chọn loại đề nghị bên trái, điền biểu mẫu. Trước khi gửi, màn hình cho biết đề nghị sẽ qua những ai duyệt và mất bao lâu.</p></SideCard>}</div>
    </div>
  );
}

export function RequestForm({ def, run, onDone }: { def: WfDef; run?: WfRun; onDone: () => void }) {
  const app = useApp();
  const { users, customers, me, notify, wfSubmit, wfCtx } = app;
  const [form, setForm] = useState<Record<string, string>>(run?.form ?? {});
  const [files, setFiles] = useState<Record<string, { name: string; url: string }[]>>(run?.files ?? {});
  const [busy, setBusy] = useState(false);
  const s: WfSubject = { requesterId: me.id, dept: me.dept, amount: wfAmountOf(def, form), vals: wfFormVals(def, form) };
  const needs = !def.trigger.length || wfNeeds(def, s);
  const path = wfPath(def, s);
  const ctx = wfCtx();
  const missing = (def.form ?? []).filter((f) => f.required && (f.type === 'FILE' ? !(files[f.id] ?? []).length : !(form[f.id] ?? '').trim()));
  const set = (id: string, v: string) => setForm((x) => ({ ...x, [id]: v }));
  const addFiles = async (id: string, fs: File[]) => {
    setBusy(true);
    try {
      const out: { name: string; url: string }[] = [];
      for (const f of fs) {
        if (f.size > 3 * 1024 * 1024 && !f.type.startsWith('image/')) { notify(`${f.name} quá 3 MB`, 'red'); continue; }
        out.push({ name: f.name, url: f.type.startsWith('image/') ? await compressImage(f, 1600) : await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('read')); r.readAsDataURL(f); }) });
      }
      setFiles((x) => ({ ...x, [id]: [...(x[id] ?? []), ...out] }));
    } catch { notify('Không đọc được file', 'red'); } finally { setBusy(false); }
  };
  const submit = () => {
    if (missing.length) return notify(`Chưa nhập: ${missing.map((f) => f.label).join(', ')}`, 'red');
    const titleField = (def.form ?? []).find((f) => f.type === 'TEXT');
    const r = wfSubmit(def.key, (titleField && form[titleField.id]) || def.name, form, files, run?.id);
    if (r) onDone();
  };
  return (
    <section className="glass-card rounded-xl p-4 xl:sticky xl:top-4">
      <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><h3 className="text-[15px] font-medium">{def.name}</h3>{def.desc && <p className="text-[12.5px] text-[rgb(var(--muted))]">{def.desc}</p>}</div>{run && <Chip tone="blue">Sửa {run.code}</Chip>}<button className="rounded p-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]" onClick={onDone} aria-label="Đóng biểu mẫu"><X className="h-4 w-4" aria-hidden /></button></div>
      {run && run.decisions.length > 0 && <p className="mt-2 rounded-lg bg-[rgb(var(--accent)/0.08)] px-3 py-2 text-[12.5px]">{DECISION_LABEL[run.decisions[run.decisions.length - 1].decision].label}: {run.decisions[run.decisions.length - 1].note}</p>}
      <div className="mt-3 space-y-3">
        {(def.form ?? []).map((f) => (
          <Field key={f.id} label={`${f.label}${f.required ? ' *' : ''}`}>
            {f.type === 'LONG' ? <textarea className={cn(inputCls, 'min-h-20')} value={form[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)} />
              : f.type === 'MONEY' ? <MoneyInput value={Number(form[f.id] ?? 0)} onChange={(n) => set(f.id, n ? String(n) : '')} />
              : f.type === 'NUMBER' ? <input className={inputCls} inputMode="decimal" value={form[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value.replace(/[^\d.,-]/g, '').replace(',', '.'))} />
              : f.type === 'DATE' ? <input type="date" className={inputCls} value={form[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)} />
              : f.type === 'SELECT' ? <select className={inputCls} value={form[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)}><option value="">Chọn</option>{(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}</select>
              : f.type === 'MULTI' ? <div className="flex flex-wrap gap-x-3 gap-y-1">{(f.options ?? []).map((o) => { const cur = (form[f.id] ?? '').split('|').filter(Boolean); return <label key={o} className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" checked={cur.includes(o)} onChange={(e) => set(f.id, (e.target.checked ? [...cur, o] : cur.filter((x) => x !== o)).join('|'))} />{o}</label>; })}</div>
              : f.type === 'USER' ? <select className={inputCls} value={form[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)}><option value="">Chọn người</option>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
              : f.type === 'LINK' ? <select className={inputCls} value={form[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)}><option value="">Chọn khách hàng</option>{customers.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
              : f.type === 'FILE' ? <div className="space-y-1.5">{(files[f.id] ?? []).map((x, i) => <div key={i} className="flex items-center gap-2 text-[12.5px]"><Paperclip className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-hidden /><a className="min-w-0 flex-1 truncate hover:underline" href={x.url} download={x.name}>{x.name}</a><button className="text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => setFiles((y) => ({ ...y, [f.id]: (y[f.id] ?? []).filter((_, j) => j !== i) }))} aria-label={`Gỡ ${x.name}`}><X className="h-3.5 w-3.5" aria-hidden /></button></div>)}<FilePicker multiple onFiles={(fs) => void addFiles(f.id, fs)} disabled={busy} className={cn(btnGhost, btnSm)}><Upload className="h-3.5 w-3.5" aria-hidden />{busy ? 'Đang đọc…' : 'Tải file / ảnh'}</FilePicker></div>
              : <input className={inputCls} value={form[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)} />}
          </Field>
        ))}
      </div>
      <div className="mt-4 rounded-lg bg-[rgb(var(--ink)/0.04)] px-3 py-2 text-[12.5px]">
        <b className="font-medium">{needs ? 'Người duyệt:' : 'Không cần duyệt'}</b>{' '}
        {needs ? path.map((st, i) => <span key={i}>{i > 0 ? ' → ' : ''}{wfApprovers(st, s, ctx).map((x) => x.u.name).join(' / ') || st.name}{st.when?.length ? ` (${st.when.filter((c) => wfCondOk(c, s)).map((c) => wfCondText(def, c)).join(', ')})` : ''}</span>) : 'theo điều kiện của quy trình, đề nghị hoàn tất ngay'}
      </div>
      <button className={cn(btnPrimary, 'mt-3 w-full justify-center')} onClick={submit} disabled={busy}><Send className="h-4 w-4" aria-hidden />{run ? 'Gửi lại đề nghị' : 'Gửi đề nghị'}</button>
    </section>
  );
}

export function RequestDetail({ r, onBack, onEdit }: { r: WfRun; onBack: () => void; onEdit: () => void }) {
  const app = useApp();
  const { users, me, company, setWfRuns, notify } = app;
  const d = app.wfDef(r.key);
  const hubOf = useHubItem();
  const it = hubOf('REQUEST', r.id);
  const [note, setNote] = useState<string | null>(null);
  const [mode, setMode] = useState<'REJECT' | 'NEED_INFO'>('REJECT');
  const cur = runStep(r);
  if (!d) return <EmptyState text="Quy trình của đề nghị này đã bị xóa" art="doc" action="Quay lại" onAction={onBack} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className={cn(btnGhost, btnSm)} onClick={onBack}><ArrowLeft className="h-3.5 w-3.5" aria-hidden />Đề nghị</button>
        <h2 className="text-[16px] font-medium">{r.title}</h2><Code>{r.code}</Code><Chip tone={RUN_STATUS[r.status].tone}>{RUN_STATUS[r.status].label}</Chip>
        <span className="ml-auto flex flex-wrap gap-2">
          <button className={btnGhost} onClick={() => printHtml(docShell(`${d.name} ${r.code}`, requestHtml(r, d, users, company)))}><Printer className="h-4 w-4" aria-hidden />In phiếu</button>
          {r.requesterId === me.id && r.status === 'PENDING' && !r.decisions.length && <button className={btnGhost} onClick={() => { setWfRuns((all) => all.map((x) => (x.id === r.id ? { ...x, status: 'CANCELLED', doneAt: Date.now() } : x))); notify(`Đã rút ${r.code}`, 'teal'); }}>Rút lại</button>}
          {r.requesterId === me.id && (r.status === 'NEED_INFO' || r.status === 'REJECTED') && <button className={btnPrimary} onClick={onEdit}><Pencil className="h-4 w-4" aria-hidden />Sửa và gửi lại</button>}
          {it && note === null && <>
            <button className={btnGhost} onClick={() => { setMode('NEED_INFO'); setNote(''); }}>Yêu cầu bổ sung</button>
            <button className={btnGhost} onClick={() => { setMode('REJECT'); setNote(''); }}>Từ chối</button>
            <button className={btnPrimary} onClick={() => it.approve?.()}><CheckCircle2 className="h-4 w-4" aria-hidden />{it.approveLabel ?? 'Duyệt'}</button>
          </>}
        </span>
      </div>
      {it && note !== null && (
        <div className="glass-card flex flex-wrap items-center gap-2 rounded-xl px-4 py-3">
          <input className={cn(inputBase, 'min-w-[260px] flex-1')} autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === 'REJECT' ? 'Lý do từ chối (gửi cho người đề nghị)' : 'Cần bổ sung gì'} aria-label="Lý do" />
          <button className={btnGhost} onClick={() => setNote(null)}>Thôi</button>
          <button className={btnPrimary} disabled={note.trim().length < 5} onClick={() => { if (mode === 'REJECT') it.reject?.(note.trim()); else it.needInfo?.(note.trim()); setNote(null); }}>{mode === 'REJECT' ? 'Từ chối' : 'Gửi yêu cầu bổ sung'}</button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <SetBlock title="Nội dung đề nghị" sub={`${d.name} · ${users.find((u) => u.id === r.requesterId)?.name ?? ''} · ${new Date(r.startedAt).toLocaleString('vi-VN')}`}>
          <dl className="divide-y divide-[rgb(var(--line))] text-[13.5px]">
            {(d.form ?? []).map((f) => (
              <div key={f.id} className="grid grid-cols-[180px_1fr] gap-3 py-2">
                <dt className="text-[rgb(var(--muted))]">{f.label}</dt>
                <dd className="min-w-0 whitespace-pre-wrap">{f.type === 'FILE' ? ((r.files?.[f.id] ?? []).length ? (r.files?.[f.id] ?? []).map((x, i) => <a key={i} className="mr-3 inline-flex items-center gap-1 hover:underline" href={x.url} download={x.name}><Paperclip className="h-3.5 w-3.5" aria-hidden />{x.name}</a>) : '—') : runVal(f, r.form?.[f.id], users)}</dd>
              </div>
            ))}
          </dl>
        </SetBlock>
        <SetBlock title="Quá trình duyệt" sub={`phiên bản ${r.version} của quy trình`}>
          <ol className="space-y-3 text-[13px]">
            {r.steps.map((s, i) => {
              const dec = r.decisions.filter((x) => x.step === i).slice(-1)[0];
              const now = i === cur && r.status === 'PENDING';
              const who = now ? wfApprovers(s, { requesterId: r.requesterId, dept: r.dept, amount: r.amount, vals: wfFormVals(d, r.form ?? {}) }, app.wfCtx()).map((x) => x.u.name).join(', ') : '';
              return (
                <li key={i} className="flex gap-2.5">
                  <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px]', dec?.decision === 'APPROVED' ? 'bg-[rgb(var(--ok)/0.15)] text-[rgb(var(--ok-fg))]' : dec ? 'bg-[rgb(var(--danger)/0.12)] text-[rgb(var(--danger-fg))]' : now ? 'bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent-fg))]' : 'bg-[rgb(var(--ink)/0.06)] text-[rgb(var(--muted))]')}>{i + 1}</span>
                  <div className="min-w-0"><p className="font-medium">{s.name}</p>
                    <p className="text-[12px] text-[rgb(var(--muted))]">{dec ? `${users.find((u) => u.id === dec.by)?.name ?? ''}${dec.onBehalf ? ` (thay ${users.find((u) => u.id === dec.onBehalf)?.name ?? ''})` : ''} · ${DECISION_LABEL[dec.decision].label} · ${new Date(dec.at).toLocaleString('vi-VN')}` : now ? `Đang chờ: ${who} · SLA ${wfSlaText(s.slaMin)}` : 'Chưa tới bước này'}</p>
                    {dec?.note && <p className="mt-0.5 text-[12.5px]">{dec.note}</p>}</div>
                </li>
              );
            })}
          </ol>
        </SetBlock>
      </div>
    </div>
  );
}

