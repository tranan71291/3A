'use client';

import { Tabs, useSticky } from '../../components/ui';
import { useApp } from '../../lib/core';
import { AllocationPage } from './allocation';
import { DataMktPage } from './data-mkt';

// =====================================================================
//  PHÂN HỆ 2: HỘP LEAD MKT & ĐIỀU PHỐI
// =====================================================================

export function LeadsModule() {
  const { presetQuery } = useApp();
  const [tab, setTab] = useSticky<'board' | 'list'>('LeadsModule.tab', presetQuery ? 'list' : 'board', !!presetQuery);
  return (
    <div className="space-y-5">
      <Tabs tabs={[{ id: 'board', label: 'Điều phối' }, { id: 'list', label: 'Data MKT' }]} value={tab} onChange={setTab} />
      {tab === 'board' ? <AllocationPage /> : <DataMktPage />}
    </div>
  );
}

