'use client';

import { Plus } from 'lucide-react';
import { Tabs, useSticky } from '../../components/ui';
import { btnPrimary, btnSm, useApp } from '../../lib/core';
import { cn } from '../../lib/utils';
import { AllocationPage } from './allocation';
import { DataMktPage } from './data-mkt';

// =====================================================================
//  PHÂN HỆ 2: HỘP LEAD MKT & ĐIỀU PHỐI
// =====================================================================

export function LeadsModule() {
  const { presetQuery, openLeadForm, canDo } = useApp();
  const [tab, setTab] = useSticky<'board' | 'list'>('LeadsModule.tab', presetQuery ? 'list' : 'board', !!presetQuery);
  return (
    <div className="space-y-4">
      <Tabs tabs={[{ id: 'board', label: 'Điều phối' }, { id: 'list', label: 'Data MKT' }]} value={tab} onChange={setTab}
        aside={canDo('lead.create') ? <button className={cn(btnPrimary, btnSm, 'max-lg:hidden')} onClick={() => openLeadForm(false)}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm lead</button> : undefined} />
      {tab === 'board' ? <AllocationPage /> : <DataMktPage />}
    </div>
  );
}

