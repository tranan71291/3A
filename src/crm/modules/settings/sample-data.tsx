'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../../components/crud';
import { Panel } from '../../components/ui';
import { btnGhost, DEMO_BUDGET_NOTE, isDemo, useApp } from '../../lib/core';
import type { ConfirmState } from '../../lib/types';
import { cn } from '../../lib/utils';

/** Dọn dữ liệu mẫu (mã demo-) còn sót từ các bản trước; app không còn chức năng nạp dữ liệu mẫu */
export function useDemoCleanup() {
  const app = useApp();
  const { me, users, setUsers, setDepartments, customers, setCustomers, leads, setLeads, setQuotes, setPos, setPrograms, setClaims, setActivities, setMktItems, setDocs, setBudgets, budget, notify, setGenDocs, setWorkOrders, setInstallJobs,
    jobs, setJobs, setReceipts, setStockMoves, setCashEntries, setGetflyOrders } = app;
  const { setZaloConvs, setZaloMsgs, setCampaigns, setContents, setAudiences, setAutomations, setKb, setHubCfg, setMktTasks, zaloConvs, campaigns } = app;
  const hubClear = () => {
    const keep = <T extends { id: string }>(xs: T[]) => xs.filter((x) => !isDemo(x.id));
    setZaloConvs(keep); setZaloMsgs((p) => p.filter((m) => !isDemo(m.convId))); setCampaigns(keep); setMktTasks(keep); setContents(keep); setAudiences(keep); setAutomations(keep); setKb(keep);
    setHubCfg((c) => ({ ...c, zalo: { ...c.zalo, znsTemplates: c.zalo.znsTemplates.filter((t) => !isDemo(t.id)) } }));
  };
  const clear = () => {
    if (isDemo(me.id)) return notify('Đang đăng nhập bằng tài khoản mẫu. Đăng nhập tài khoản quản trị rồi xóa.', 'red');
    const keepId = <T extends { id: string }>(xs: T[]) => xs.filter((x) => !isDemo(x.id));
    setUsers(keepId);
    setDepartments((p) => p.map((d) => (isDemo(d.headId) ? { ...d, headId: undefined } : d)));
    setCustomers(keepId);
    setLeads(keepId);
    setQuotes((p) => p.filter((q) => !isDemo(q.id) && !isDemo(q.leadId)));
    setPrograms(keepId);
    setClaims(keepId);
    setPos(keepId);
    setActivities(keepId);
    setMktItems(keepId);
    setDocs(keepId);
    setWorkOrders(keepId);
    setInstallJobs(keepId);
    setJobs(keepId);
    setReceipts(keepId);
    setGetflyOrders((p) => p.filter((o) => !o.orderCode.startsWith('DH-DEMO-')));
    setStockMoves(keepId);
    setCashEntries(keepId);
    setGenDocs((p) => p.filter((d) => !isDemo(d.leadId) && !isDemo(d.customerId)));
    setBudgets((list) => list.filter((b) => b.note !== DEMO_BUDGET_NOTE || b.fiscalYear === budget.fiscalYear));
    hubClear();
    notify('Đã xóa dữ liệu mẫu', 'orange');
  };
  const hasDemo = users.some((x) => isDemo(x.id)) || leads.some((x) => isDemo(x.id)) || customers.some((x) => isDemo(x.id)) || jobs.some((x) => isDemo(x.id)) || zaloConvs.some((x) => isDemo(x.id)) || campaigns.some((x) => isDemo(x.id));
  return { clear, hasDemo };
}

/** Chỉ hiện khi còn dữ liệu mẫu từ bản cũ */
export function LegacyDemoPanel() {
  const { canDo } = useApp();
  const { clear, hasDemo } = useDemoCleanup();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  if (!hasDemo) return null;
  return (
    <Panel title="Dữ liệu mẫu từ bản cũ">
      <p className="text-sm text-[rgb(var(--muted))]">Doanh nghiệp còn dữ liệu mẫu (tài khoản, khách hàng, đơn, hội thoại có mã demo-) từ các bản trước. Xóa để bắt đầu với dữ liệu thật.</p>
      <button className={cn(btnGhost, 'mt-3 text-[rgb(var(--danger-fg))]')} disabled={!canDo('settings.edit')} onClick={() => setConfirm({ title: 'Xóa dữ liệu mẫu', message: 'Xóa toàn bộ bản ghi mẫu (mã demo-)? Dữ liệu bạn tự nhập được giữ nguyên.', confirmLabel: 'Xóa dữ liệu mẫu', onConfirm: clear })}><Trash2 className="h-4 w-4" aria-hidden />Xóa dữ liệu mẫu</button>
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </Panel>
  );
}

