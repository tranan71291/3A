// =====================================================================
//  v59 BỘ GIAO DIỆN LÕI 3A (UI Kit) — dùng chung cho mọi module và màn Xem trước của 3A Studio
//  Quy tắc: không đổi màu / font hệ thống; mọi màu đọc token THEME_CSS; bảng theo v49; thao tác mở bảng trượt phải.
// =====================================================================

export { PageHeader, Breadcrumbs, type PageAction, type Crumb, type KitIcon } from './page-header';
export { SmartDataTable, type DataCol } from './data-table';
export { FilterPopover, FilterChips, type ActiveFilter } from './filter-popover';
export { StatusBar, StatusChecklist, StatusScope, stMatch, stEffective, type StatusOpt, type StatusFilterProps } from './status-filter';
export { SlideOverDrawer, type DrawerSize } from './slide-over';
export { StatKpiCard } from './kpi-card';
export { StatusBadge, WorkflowStepper, TONE_OF, type StatusTone, type StepState, type WorkflowStep } from './status';
export { EmptyState, EmptyArt, type EmptyKind } from './empty-state';
export { kCard, kPop, kLabel, kTitle, kIconBtn, kCountBadge } from './tokens';
export { useTaxLookup, TaxStrip, TaxResultCard, TaxPortalLink, taxTime, type TaxState } from './tax-lookup';
