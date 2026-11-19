'use client';

import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Building2, Camera, CheckCircle2, ChevronDown, Command, Factory, Globe, LogOut, Menu, MessageSquare, Moon, PanelLeftClose, PanelLeftOpen, RefreshCw, Search, Sparkles, Sun, Wallet, X, XCircle } from 'lucide-react';
import { ChangePasswordModal, Logo3A, NotificationBell, SyncChip, TenantSwitcher, UserMenu } from './header';
import { CommandPalette } from '../components/command-palette';
import { Avatar, DateRangePicker } from '../components/controls';
import { periodRange } from '../components/filters';
import { Skeleton } from '../components/ui';
import { fundUsage, scoreLead, shipmentAllocation } from '../lib/business';
import { canon, cloudMessage, statsOf } from '../lib/cloud';
import { addDaysISO, AVATARS, bizMode, blockersOf, btnBase, btnGhost, BUSINESS_PROFILE, C, canSeeConv, cloud, CLOUD_ON, CloudError, compact, CONSOLE_TABS, Ctx, DATA_VERSION, dataKey, DATE_PAGES, daysTo, DEFAULT_MFG_CONFIG, DEFAULT_SCOPE, defaultTenantReg, DEMO_PASSWORD, EMAIL_PRESET, EMPTY_CUSTOMER, findByTax, fmtDate, fmtN, fold, GF_ALL, GRAD, INITIAL_AI_QUOTA, INITIAL_BUDGET, INITIAL_CATEGORIES, INITIAL_CLAIMS, INITIAL_COMPANY, INITIAL_CUSTOMERS, INITIAL_DEPARTMENTS, INITIAL_DOCS, INITIAL_EMAIL, INITIAL_GETFLY, INITIAL_GETFLY_ORDERS, INITIAL_HUB_CFG, INITIAL_MKT_ITEMS, INITIAL_NOTIFY_RULES, INITIAL_PERMS, INITIAL_PLATFORM_ADMINS, INITIAL_POLICY, INITIAL_POP_DOCS, INITIAL_PROGRAMS, INITIAL_SECURITY, INITIAL_SEGMENTS, INITIAL_SKUS, INITIAL_SOURCES, INITIAL_TIER_RULES, INITIAL_USERS, INITIAL_WAREHOUSES, INITIAL_ZNS, inputCls, isAcceptLate, isoDay, isPlatformEmail, isQuoteOverdue, LAST_ORG_KEY, LEGACY_STORE_KEY, lineNet, LOST_REASON, MAIN_WH, MODULE_ICON, MODULE_LABEL, MODULE_SHORT, ModuleBoundary, moduleEnabled, MODULES, NAV_GROUPS, nextCode, nextVoucherCode, oldDataKey, orgByEmail, orgIdIssue, orgOf, ORGS, PLATFORM_KEY, PLATFORM_TENANT, QUOTE_SLA_MS, receivedReservedFor, ROLE_LABEL, ROLE_PERSONA, ROLES, saleIssued, salePaid, saleResOf, secretKeep, secretless, SESSION_KEY, snapPrefix, sourceFromChannel, stickyReset, stickyStore, storage, TENANT_PLAN, tenantCloudStats, TenantSync, THEME_CSS, TIERS, todayISO, UI_KEY, uid, v18DataKey, vnd, WF_POLICY, wfAmountOf, wfFormVals, wfNeeds, wfReasons, znsPhone } from '../lib/core';
import { buildGetflyPayload, financialsFromOrders, saleStock, saleTotals } from '../lib/getfly';
import { LoginScreen, orgDefaults, pathOrgOf, registerOrgs, regsFromStored, setPathOrg } from '../lib/modules';
import { initialNotices } from '../lib/notify';
import { encryptBackup, hashPassword, verifyPassword } from '../lib/security';
import { listSnapshots, migrateData, takeSnapshot, withDefaults } from '../lib/storage';
import type { Action, Activity, AiQuotaCfg, AllocSnapshot, AnyRec, AppCtx, ApprovalDecision, ApprovalKind, ApprovalLog, Audience, AuditLevel, AuditLog, Automation, AutoRun, BannerSpec, Brief, Budget, BudgetCategory, Campaign, CashDraft, CashEntry, Channel, ChatChannel, Claim, CompanyInfo, ConsoleTab, ContentVersion, Customer, CustomerSource, DataScope, DateRange, Department, DeptCode, DocItem, DocTemplate, DraftProduct, EmailConfig, GeneratedDoc, GetflyConfig, GetflyLog, GetflyOrderRec, GlobalFilter, HubCfg, InstallJob, InvMove, InvMoveType, Job, KbItem, KpiTarget, Lead, LostReason, MfgConfig, MktContent, MktImage, MktItem, MktTask, Module, MsgLog, Notice, NoticeKind, NotifyEvent, Org, OrgChoices, Perms, PlatformLog, PoAllocation, Policy, PopDocDef, Post, PriceItem, Program, Quote, QuoteStatus, Receipt, RemoteBatch, Role, RowComment, SaleDelivery, SaleLine, SalePay, SalePayment, SalesOrder, SaleStatus, SaleStockData, SecurityPolicy, SegmentDef, SegmentRules, SkuItem, SocialPost, StockItem, StockMove, StockMoveType, StockReservation, StockVoucher, StoredData, SyncInfo, TenantPlan, TenantReg, TierRule, ToastT, Tone, User, UserPerm, VendorPO, WarehouseInfo, WfCtx, WfDecideArgs, WfDecision, WfDef, WfDelegation, WfPolicy, WfRun, WfRunStatus, WfSubject, WorkOrder, ZaloConv, ZaloMsg, ZnsConfig, ZnsTemplateKey } from '../lib/types';
import { cn, initialLeads, initialMoves, initialPOs, initialQuotes, initialReservations, syncCatalog, wfApprovers, wfMerge, wfPath } from '../lib/utils';
import { stockOf } from '../lib/workshop';
import { AiChatBot } from '../modules/ai/copilot-plus';
import { InstallModule } from '../modules/alux/install';
import { InventoryModule } from '../modules/alux/materials';
import { JobDrawer, JobsModule, MfgLeadsPage } from '../modules/alux/orders';
import { MfgCustomersPage } from '../modules/alux/overview';
import { ProductionModule } from '../modules/alux/production';
import { ContactsPage } from '../modules/contacts/contacts';
import { CustomerDrawer, CustomerFormModal, CustomersPage } from '../modules/customers/customer-360';
import { CashbookModule } from '../modules/finance/cashbook';
import { HomePage } from '../modules/home/home';
import { AssistantCommandBar } from '../modules/home/social-hub';
import { LeadsModule } from '../modules/leads/inbox';
import { LeadFormModal } from '../modules/leads/lead-form';
import { ContentReviewHost } from '../modules/marketing/content-workspace';
import { AiContentWorker, AutomationEngine, MarketingHubPage } from '../modules/marketing/marketing-hub';
import { ClaimDrawer, ClaimsModule } from '../modules/mdf/claims';
import { ProgramFormModal } from '../modules/mdf/programs';
import { CommHub } from '../modules/messages/comm-hub';
import { MessengerPage, OverviewPage } from '../modules/messages/messenger';
import { PlatformConsole } from '../modules/platform/console';
import { SkuCatalog } from '../modules/products/catalog';
import { ProjectsPage } from '../modules/projects/projects';
import { ReportsPage } from '../modules/reports/reports';
import { SalesModule } from '../modules/sales/orders';
import { DocComposerModal, DocsModule } from '../modules/sales/quote';
import { WinModal } from '../modules/sales/sales-flow';
import { initialDocTemplates } from '../modules/sales/templates';
import { BrandMark } from '../modules/settings/company';
import { SettingsModule } from '../modules/settings/security-data';
import { StaffModule } from '../modules/staff/staff';
import { SupplyModule } from '../modules/supply/purchase-orders';
import { TaskBadge, TasksModule } from '../modules/tasks/tasks';
import { applyVoucher, WarehouseModule } from '../modules/warehouse/warehouse';
import { ZaloHubPage } from '../modules/zalo/zalo-hub';

export default function DashboardApp() {
  const [ready, setReady] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [platformAdmins, setPlatformAdmins] = useState<User[]>(INITIAL_PLATFORM_ADMINS);
  const [platformTenants, setPlatformTenants] = useState<TenantReg[]>(() => ORGS.map(defaultTenantReg));
  const [platformLogs, setPlatformLogs] = useState<PlatformLog[]>([]);
  const [consoleView, setConsoleView] = useState(false);
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>('overview');
  const [platformId, setPlatformId] = useState<string | null>(null);
  /** v39: mã doanh nghiệp trong đường dẫn (crm.3agroup.vn/<mã>), nhận diện tải từ máy chủ khi chưa đăng nhập, danh sách chọn doanh nghiệp sau đăng nhập */
  const [pathOrgId, setPathOrgId] = useState<string | null>(null);
  const [remoteBrand, setRemoteBrand] = useState<Org | null>(null);
  const [orgChoices, setOrgChoices] = useState<OrgChoices | null>(null);
  const pendingLogin = useRef<{ remember: boolean; password?: string }>({ remember: false });
  const rememberRef = useRef(false);
  const [loginAt, setLoginAt] = useState<number | null>(null);
  const [page, setPage] = useState<Module>('home');
  const [presetQuery, setPresetQuery] = useState('');
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [departments, setDepartments] = useState<Department[]>(INITIAL_DEPARTMENTS);
  const [budgets, setBudgets] = useState<Budget[]>([INITIAL_BUDGET]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [policy, setPolicy] = useState<Policy>(INITIAL_POLICY);
  const [programs, setPrograms] = useState<Program[]>(INITIAL_PROGRAMS);
  const [claims, setClaims] = useState<Claim[]>(INITIAL_CLAIMS);
  const [perms, setPerms] = useState<Perms>(INITIAL_PERMS);
  // Phân hệ mới chưa có trong cấu hình cũ (vd. sau hot-reload) thì lấy theo mặc định
  const myPerm: UserPerm | undefined = sessionId ? perms.users?.[sessionId] : undefined;
  AVATARS.clear(); users.forEach((u) => { if (u.avatar) AVATARS.set(u.name, u.avatar); });
  const seeModule = (m: Module) => myPerm?.modules?.[m] ?? perms.modules[role]?.[m] ?? INITIAL_PERMS.modules[role][m];
  const [segments, setSegments] = useState<SegmentDef[]>(INITIAL_SEGMENTS);
  const [categories, setCategories] = useState<BudgetCategory[]>(INITIAL_CATEGORIES);
  const [popDocs, setPopDocs] = useState<PopDocDef[]>(INITIAL_POP_DOCS);
  const [sources, setSources] = useState<CustomerSource[]>(INITIAL_SOURCES);
  const [mktItems, setMktItems] = useState<MktItem[]>(INITIAL_MKT_ITEMS);
  const [company, setCompany] = useState<CompanyInfo>(INITIAL_COMPANY);
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
  const [skus, setSkus] = useState<SkuItem[]>(INITIAL_SKUS);
  const [pos, setPos] = useState<VendorPO[]>(initialPOs);
  const [reservations, setReservations] = useState<StockReservation[]>(initialReservations);
  const [moves, setMoves] = useState<StockMove[]>(initialMoves);
  const [warehouses, setWarehouses] = useState<WarehouseInfo[]>(INITIAL_WAREHOUSES);
  const [stockVouchers, setStockVouchers] = useState<StockVoucher[]>([]);
  const [zaloConvs, setZaloConvs] = useState<ZaloConv[]>([]);
  const [zaloMsgs, setZaloMsgs] = useState<ZaloMsg[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contents, setContents] = useState<MktContent[]>([]);
  const [banners, setBanners] = useState<BannerSpec[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [autoRuns, setAutoRuns] = useState<AutoRun[]>([]);
  const [kb, setKb] = useState<KbItem[]>([]);
  const [mktTasks, setMktTasks] = useState<MktTask[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [draftProducts, setDraftProducts] = useState<DraftProduct[]>([]);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [kpiTargets, setKpiTargets] = useState<KpiTarget[]>([]);
  const [contentVersions, setContentVersions] = useState<ContentVersion[]>([]);
  const [mktImages, setMktImages] = useState<MktImage[]>([]);
  const [aiQuota, setAiQuota] = useState<AiQuotaCfg>(INITIAL_AI_QUOTA);
  const [hubCfg, setHubCfg] = useState<HubCfg>(INITIAL_HUB_CFG);
  const [docTemplates, setDocTemplates] = useState<DocTemplate[]>(initialDocTemplates);
  const [genDocs, setGenDocs] = useState<GeneratedDoc[]>([]);
  const [orgId, setOrgId] = useState<string>(ORGS[0].id);
  /** Doanh nghiệp có dữ liệu đang nạp trong bộ nhớ (chỉ tự lưu khi khớp orgId) */
  const [loadedOrg, setLoadedOrg] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockMoves, setStockMoves] = useState<InvMove[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [wfDefs, setWfDefs] = useState<WfDef[]>([]);
  const [wfRuns, setWfRuns] = useState<WfRun[]>([]);
  const [wfPolicy, setWfPolicy] = useState<WfPolicy>(WF_POLICY);
  const [wfDelegations, setWfDelegations] = useState<WfDelegation[]>([]);
  const [priceItems, setPriceItems] = useState<PriceItem[]>([]);
  const [mfgConfig, setMfgConfig] = useState<MfgConfig>(DEFAULT_MFG_CONFIG);
  const [approvalLogs, setApprovalLogs] = useState<ApprovalLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [security, setSecurity] = useState<SecurityPolicy>(INITIAL_SECURITY);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [installJobs, setInstallJobs] = useState<InstallJob[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [savedBytes, setSavedBytes] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  /** Dữ liệu trên máy mới hơn bản app đang chạy: không ghi đè */
  const [dataLocked, setDataLocked] = useState<number | null>(null);
  const [snapTick, setSnapTick] = useState(0);
  const [mustChange, setMustChange] = useState(false);
  const [idleOut, setIdleOut] = useState(false);
  /** Người đăng nhập thật (khi BOD chuyển vai trò để xem thử) */
  const [realUserId, setRealUserId] = useState<string | null>(null);
  const lastActive = useRef<number>(Date.now());
  // ---- Đồng bộ đám mây (Supabase): bộ đồng bộ doanh nghiệp đang mở + dữ liệu nền tảng 3A ----
  const syncRef = useRef<TenantSync | null>(null);
  const platSyncRef = useRef<TenantSync | null>(null);
  const [syncInfo, setSyncInfo] = useState<SyncInfo | null>(null);
  const [cloudBoot, setCloudBoot] = useState(CLOUD_ON);
  const [cloudBusy, setCloudBusy] = useState(false);
  const orgRef = useRef<string>(ORGS[0].id);
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ leadId?: string; customerId?: string; docId?: string; quoteId?: string; mode?: 'QUOTE' | 'CONTRACT'; view?: boolean; edit?: boolean; reviseOf?: string } | null>(null);
  const [winFor, setWinFor] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>(() => periodRange('YEAR', INITIAL_BUDGET.fiscalYear));
  const [leadForm, setLeadForm] = useState<{ asProject?: boolean; id?: string } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  /** Tìm bằng hình ảnh: file kéo thả vào ô tìm kiếm, hoặc 'pick' để mở hộp chọn ảnh */
  const [paletteImg, setPaletteImg] = useState<File | 'pick' | null>(null);
  const [intent, setIntent] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tierRules, setTierRules] = useState<TierRule[]>(INITIAL_TIER_RULES);
  const [getflyOrders, setGetflyOrders] = useState<GetflyOrderRec[]>(INITIAL_GETFLY_ORDERS);
  const [getfly, setGetfly] = useState<GetflyConfig>(INITIAL_GETFLY);
  const [getflyLogs, setGetflyLogs] = useState<GetflyLog[]>([]);
  const [notices, setNotices] = useState<Notice[]>(initialNotices);
  const [ringKey, setRingKey] = useState(0);
  const [msgLogs, setMsgLogs] = useState<MsgLog[]>([]);
  const [emailCfg, setEmailCfg] = useState<EmailConfig>(INITIAL_EMAIL);
  const [zns, setZns] = useState<ZnsConfig>(INITIAL_ZNS);
  const [notifyRules, setNotifyRules] = useState<Record<NotifyEvent, Channel[]>>(INITIAL_NOTIFY_RULES);
  const [docs, setDocs] = useState<DocItem[]>(INITIAL_DOCS);
  const [comments, setComments] = useState<RowComment[]>([]);
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [openClaimId, setOpenClaimId] = useState<string | null>(null);
  const [openCustomerId, setOpenCustomerId] = useState<string | null>(null);
  const [programForm, setProgramForm] = useState<{ customerId?: string; programId?: string } | null>(null);
  const [customerForm, setCustomerForm] = useState<{ id?: string } | null>(null);
  const [toast, setToast] = useState<ToastT | null>(null);
  const [now, setNow] = useState<number | null>(null); // null khi SSR -> tránh lệch hydration
  const orderSeq = useRef<number>(18300);

  // ---- Dữ liệu được lưu trên máy (có phiên bản). Khóa bí mật tích hợp không lưu. ----
  const persisted: Record<string, [unknown, (v: never) => void, unknown]> = {
    leads: [leads, setLeads, initialLeads], customers: [customers, setCustomers, INITIAL_CUSTOMERS], users: [users, setUsers, INITIAL_USERS],
    departments: [departments, setDepartments, INITIAL_DEPARTMENTS], budgets: [budgets, setBudgets, [INITIAL_BUDGET]], activities: [activities, setActivities, []],
    policy: [policy, setPolicy, INITIAL_POLICY], programs: [programs, setPrograms, INITIAL_PROGRAMS], claims: [claims, setClaims, INITIAL_CLAIMS],
    perms: [perms, setPerms, INITIAL_PERMS], segments: [segments, setSegments, INITIAL_SEGMENTS], categories: [categories, setCategories, INITIAL_CATEGORIES],
    popDocs: [popDocs, setPopDocs, INITIAL_POP_DOCS], sources: [sources, setSources, INITIAL_SOURCES], mktItems: [mktItems, setMktItems, INITIAL_MKT_ITEMS],
    company: [company, setCompany, INITIAL_COMPANY], quotes: [quotes, setQuotes, initialQuotes], skus: [skus, setSkus, INITIAL_SKUS], pos: [pos, setPos, initialPOs],
    reservations: [reservations, setReservations, initialReservations], moves: [moves, setMoves, initialMoves], warehouses: [warehouses, setWarehouses, INITIAL_WAREHOUSES], stockVouchers: [stockVouchers, setStockVouchers, []], zaloConvs: [zaloConvs, setZaloConvs, []], zaloMsgs: [zaloMsgs, setZaloMsgs, []], campaigns: [campaigns, setCampaigns, []], contents: [contents, setContents, []], banners: [banners, setBanners, []], audiences: [audiences, setAudiences, []], automations: [automations, setAutomations, []], autoRuns: [autoRuns, setAutoRuns, []], kb: [kb, setKb, []], mktTasks: [mktTasks, setMktTasks, []], briefs: [briefs, setBriefs, []], draftProducts: [draftProducts, setDraftProducts, []], socialPosts: [socialPosts, setSocialPosts, []], kpiTargets: [kpiTargets, setKpiTargets, []], contentVersions: [contentVersions, setContentVersions, []], mktImages: [mktImages, setMktImages, []], aiQuota: [aiQuota, setAiQuota, INITIAL_AI_QUOTA], hubCfg: [hubCfg, setHubCfg, INITIAL_HUB_CFG], docTemplates: [docTemplates, setDocTemplates, []],
    genDocs: [genDocs, setGenDocs, []], salesOrders: [salesOrders, setSalesOrders, []], wfDefs: [wfDefs, setWfDefs, []], wfRuns: [wfRuns, setWfRuns, []], wfPolicy: [wfPolicy, setWfPolicy, WF_POLICY], wfDelegations: [wfDelegations, setWfDelegations, []], tierRules: [tierRules, setTierRules, INITIAL_TIER_RULES], getflyOrders: [getflyOrders, setGetflyOrders, INITIAL_GETFLY_ORDERS],
    getfly: [getfly, setGetfly, INITIAL_GETFLY], notices: [notices, setNotices, initialNotices], emailCfg: [emailCfg, setEmailCfg, INITIAL_EMAIL], zns: [zns, setZns, INITIAL_ZNS],
    notifyRules: [notifyRules, setNotifyRules, INITIAL_NOTIFY_RULES], docs: [docs, setDocs, INITIAL_DOCS], comments: [comments, setComments, []], channels: [channels, setChannels, []], posts: [posts, setPosts, []], approvalLogs: [approvalLogs, setApprovalLogs, []],
    auditLogs: [auditLogs, setAuditLogs, []], security: [security, setSecurity, INITIAL_SECURITY], workOrders: [workOrders, setWorkOrders, []], installJobs: [installJobs, setInstallJobs, []],
    jobs: [jobs, setJobs, []], receipts: [receipts, setReceipts, []], stockItems: [stockItems, setStockItems, []], stockMoves: [stockMoves, setStockMoves, []], cashEntries: [cashEntries, setCashEntries, []], priceItems: [priceItems, setPriceItems, []], mfgConfig: [mfgConfig, setMfgConfig, DEFAULT_MFG_CONFIG],
  };
  /** Đọc toàn bộ dữ liệu để lưu / sao lưu; bỏ khóa bí mật (API key, mật khẩu SMTP, secret ZNS) */
  const collectData = (): Record<string, unknown> => {
    const out: AnyRec = Object.fromEntries(Object.entries(persisted).map(([k, [v]]) => [k, secretless(k, v)]));
    return out;
  };
  /** Nạp dữ liệu đã nâng cấp: mảng lấy nguyên, đối tượng cấu hình lấp mặc định cho khóa mới */
  const applyData = (data: AnyRec) => {
    for (const [k, [, set, def]] of Object.entries(persisted)) {
      if (!(k in data)) continue;
      const v = data[k];
      if (Array.isArray(def)) { if (Array.isArray(v)) (set as (x: unknown) => void)(v); }
      else if (def && typeof def === 'object') {
        const keepSecret = k === 'getfly' ? { apiKey: getfly.apiKey, webhookSecret: getfly.webhookSecret } : k === 'emailCfg' ? { password: emailCfg.password } : k === 'zns' ? { secretKey: zns.secretKey } : {};
        (set as (x: unknown) => void)({ ...withDefaults(v, def as AnyRec), ...Object.fromEntries(Object.entries(keepSecret).filter(([, x]) => x)) });
      }
    }
  };

  /**
   * Nạp dữ liệu của một doanh nghiệp: thay toàn bộ state bằng dữ liệu đã lưu của doanh nghiệp đó
   * (nâng cấp nếu cần), phần chưa có lấy cấu hình khởi tạo riêng. Trả về danh sách tài khoản.
   */
  const loadOrg = (org: string, regs: TenantReg[] = platformTenants, cloudData?: { data: AnyRec; version: number }): User[] => {
    const defaults: AnyRec = { ...Object.fromEntries(Object.entries(persisted).map(([k, x]) => [k, x[2]])), docTemplates: initialDocTemplates(), ...orgDefaults(org, Object.fromEntries(Object.entries(persisted).map(([k, x]) => [k, x[2]]))) };
    let raw = cloudData ? null : storage.get(dataKey(org));
    if (!raw && !cloudData) {
      raw = storage.get(v18DataKey(org)) ?? storage.get(oldDataKey(org)) ?? (org === ORGS[0].id ? storage.get(LEGACY_STORE_KEY) : null);
      if (raw) storage.set(dataKey(org), raw);
    }
    let data: AnyRec = {};
    setDataLocked(null); setSavedAt(null); setSavedBytes(0);
    if (raw) {
      try {
        const st = JSON.parse(raw) as StoredData;
        const from = st.v ?? 0;
        if (from > DATA_VERSION) setDataLocked(from);
        data = (st.data ?? {}) as AnyRec;
        if (from < DATA_VERSION) { takeSnapshot(org, `nang-cap-tu-v${from}`); data = migrateData(data, from).data; }
        setSavedAt(st.savedAt ?? null);
        setSavedBytes(raw.length * 2);
      } catch { takeSnapshot(org, 'loi-doc-du-lieu'); }
    }
    if (cloudData) {
      // Dữ liệu từ máy chủ: nâng cấp cấu trúc nếu bản lưu cũ hơn app (kết quả tự gửi lại máy chủ)
      data = cloudData.data;
      if (cloudData.version > DATA_VERSION) setDataLocked(cloudData.version);
      else if (cloudData.version > 0 && cloudData.version < DATA_VERSION) data = migrateData(data, cloudData.version).data;
      setSavedAt(Date.now());
    }
    orgRef.current = org;
    for (const [k, x] of Object.entries(persisted)) {
      const def = defaults[k];
      const v = k in data ? data[k] : def;
      const set = x[1] as (y: unknown) => void;
      if (Array.isArray(def)) set(Array.isArray(v) && (v.length || k !== 'docTemplates') ? v : def);
      else if (def && typeof def === 'object') set(withDefaults(v, def as AnyRec));
      else set(v);
    }
    // Gói phân hệ do nền tảng 3A cố định theo doanh nghiệp: VASSH thương mại, ALUX xưởng
    const reg = regs.find((r) => r.id === org) ?? defaultTenantReg(orgOf(org));
    setCompany((c) => ({ ...c, profile: orgOf(org).profile, enabledModules: reg.modules }));
    setOrgId(org);
    setLoadedOrg(org);
    setPage('home');
    setOpenJobId(null); setOpenClaimId(null); setOpenCustomerId(null);
    return Array.isArray(data.users) ? (data.users as User[]) : ((defaults.users as User[]) ?? INITIAL_USERS);
  };
  /** Chọn doanh nghiệp ở màn đăng nhập */
  const chooseOrg = (org: string): User[] => {
    if (org === orgId || !ORGS.some((o) => o.id === org)) return users;
    stickyReset();
    const list = loadOrg(org, platformTenants, CLOUD_ON ? { data: {}, version: DATA_VERSION } : undefined);
    storage.set(LAST_ORG_KEY, org);
    return list;
  };

  // ---- Lần đầu mở: nạp dữ liệu doanh nghiệp gần nhất (nâng cấp nếu cần), khôi phục phiên đăng nhập ----
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY); } catch { /* bỏ qua */ }
    let sess: { id: string; at: number; exp?: number; org?: string; platform?: boolean } | null = null;
    try { sess = saved ? JSON.parse(saved) : null; } catch { sess = null; }
    let admins = INITIAL_PLATFORM_ADMINS;
    let regs = ORGS.map(defaultTenantReg);
    try {
      const p = storage.get(PLATFORM_KEY);
      if (p) {
        const pl = JSON.parse(p) as { admins?: User[]; tenants?: TenantReg[]; logs?: PlatformLog[] };
        if (Array.isArray(pl.admins) && pl.admins.length) admins = [...pl.admins, ...INITIAL_PLATFORM_ADMINS.filter((d) => !pl.admins!.some((a) => a.email === d.email))];
        // Hồ sơ doanh nghiệp: bổ sung doanh nghiệp / module / tính năng mới với giá trị mặc định, không xóa cấu hình cũ
        if (Array.isArray(pl.tenants)) regs = regsFromStored(pl.tenants);
        if (Array.isArray(pl.logs)) setPlatformLogs(pl.logs);
      }
    } catch { /* dùng mặc định */ }
    setPlatformAdmins(admins);
    setPlatformTenants(regs);
    const po = pathOrgOf();
    setPathOrgId(po);
    let org = (po && ORGS.some((o) => o.id === po) ? po : null) ?? sess?.org ?? storage.get(LAST_ORG_KEY) ?? ORGS[0].id;
    if (!ORGS.some((o) => o.id === org)) org = ORGS[0].id;
    if (CLOUD_ON) {
      // Chế độ đám mây: không đọc dữ liệu nghiệp vụ trên máy; khôi phục phiên Supabase nếu còn
      loadOrg(org, regs, { data: {}, version: DATA_VERSION });
      setHydrated(true);
      setNow(Date.now());
      const t = setInterval(() => setNow(Date.now()), 1000);
      void (async () => {
        if (cloud.loadSession()) {
          const err = await cloudGate(cloud.remember, undefined, true);
          if (err) setToast({ msg: err, tone: 'red' });
        }
        setCloudBoot(false);
        setReady(true);
      })();
      return () => clearInterval(t);
    }
    const knownUsers = loadOrg(org, regs);
    try {
      if (sess) {
        const s = sess;
        if (!s.platform && regs.find((r) => r.id === org)?.status === 'SUSPENDED') throw new Error('suspended');
        const u = (s.platform ? admins : knownUsers).find((x) => x.id === s.id && x.active);
        if (u && s.platform) { setPlatformId(u.id); setConsoleView(true); }
        if (u && (!s.exp || s.exp > Date.now()) && !(u.lockedUntil && u.lockedUntil > Date.now())) { setSessionId(s.id); setRealUserId(s.id); setLoginAt(s.at); }
        else { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); }
      }
    } catch { try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch { /* bỏ qua */ } }
    setHydrated(true);
    setReady(true);
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Lưu tài khoản quản trị nền tảng (tách khỏi dữ liệu doanh nghiệp) ----
  useEffect(() => {
    if (!hydrated) return;
    storage.set(PLATFORM_KEY, JSON.stringify({ admins: CLOUD_ON ? [] : platformAdmins, tenants: platformTenants, logs: CLOUD_ON ? [] : platformLogs.slice(0, 300) }));
    if (CLOUD_ON && platformId && platSyncRef.current) platSyncRef.current.schedule({ tenants: platformTenants, logs: platformLogs.slice(0, 300) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, platformAdmins, platformTenants, platformLogs]);

  // ---- Tự lưu (sau 0,6 giây không đổi) ----
  useEffect(() => {
    if (!hydrated || dataLocked || loadedOrg !== orgId) return;
    if (CLOUD_ON) {
      // Đám mây: chỉ gửi khi đã đăng nhập và bộ đồng bộ đúng doanh nghiệp đang mở; không lưu dữ liệu nghiệp vụ trên máy
      if (sessionId && syncRef.current && syncRef.current.tenant === orgId) syncRef.current.schedule(collectData());
      return;
    }
    const t = setTimeout(() => {
      const at = Date.now();
      const json = JSON.stringify({ v: DATA_VERSION, savedAt: at, data: collectData() } satisfies StoredData);
      if (storage.set(dataKey(orgId), json)) { setSavedAt(at); setSavedBytes(json.length * 2); }
      else setToast({ msg: 'Bộ nhớ trình duyệt đầy, chưa lưu được. Vào Cài đặt > Dữ liệu & bảo mật để sao lưu rồi dọn ảnh / file đính kèm.', tone: 'red' });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, dataLocked, loadedOrg, orgId, ...Object.values(persisted).map((x) => x[0])]);

  // ---- Tự đăng xuất khi không thao tác ----
  useEffect(() => {
    const mark = () => { lastActive.current = Date.now(); };
    const evs = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    evs.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    return () => evs.forEach((e) => window.removeEventListener(e, mark));
  }, []);
  useEffect(() => {
    if (!sessionId || now == null || !security.idleMinutes) return;
    if (now - lastActive.current > security.idleMinutes * 60_000) {
      writeAudit('IDLE_LOGOUT', `Tự đăng xuất sau ${security.idleMinutes} phút không thao tác`, 'SECURITY', realUserId ?? sessionId);
      logout();
      setIdleOut(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // Sidebar mặc định thu gọn (chỉ icon), rê chuột thì mở rộng dạng nổi; ghim (Ctrl + B) để luôn mở. Nhớ theo trình duyệt
  const [sideMini, setSideMini] = useState(false);
  /** Nhãn nổi khi rê chuột / focus vào icon menu thu gọn (không mở rộng menu) */
  const [railTip, setRailTip] = useState<{ label: string; y: number } | null>(null);
  const [fundOpen, setFundOpen] = useState(false);
  const [gf, setGf] = useState<GlobalFilter>(GF_ALL);
  // Giao diện Tối / Sáng: lưu theo trình duyệt, áp lên <html class="light"> (cả hộp thoại đưa ra <body>)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => {
    try {
      // v27: mặc định nội dung nền sáng (menu trái vẫn tối); sau đó tôn trọng lựa chọn của người dùng
      if (!localStorage.getItem('3a:ui:theme-v27')) { localStorage.setItem('3a:ui:theme-v27', '1'); setTheme('light'); return; }
      if (localStorage.getItem('3a:ui:theme') === 'light') setTheme('light');
    } catch { /* bỏ qua */ }
  }, []);
  useEffect(() => {
    // Trang đăng nhập luôn giữ nền tối thương hiệu; nền sáng chỉ áp sau khi đăng nhập
    const light = theme === 'light' && !!sessionId;
    document.documentElement.classList.toggle('light', light);
    document.documentElement.style.colorScheme = light ? 'light' : 'dark';
    try { localStorage.setItem('3a:ui:theme', theme); } catch { /* bỏ qua */ }
  }, [theme, sessionId]);
  // Cột phải: Chat nội bộ + AI Copilot
  const [hub, setHub] = useState<null | 'chat' | 'ai'>(null);
  const [hubAsk, setHubAsk] = useState<string | null>(null);
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [foldGroups, setFoldGroups] = useState<string[]>([]);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(UI_KEY) ?? '{}') as { pin40?: boolean; fold?: string[]; fund?: boolean; gf?: unknown };
      setSideMini(v.pin40 === false);
      setFundOpen(v.fund === true);
      setFoldGroups(Array.isArray(v.fold) ? v.fold : []);
    } catch { /* bỏ qua */ }
  }, []);
  const uiSaved = useRef(false);
  useEffect(() => {
    if (!uiSaved.current) { uiSaved.current = true; return; }
    try { localStorage.setItem(UI_KEY, JSON.stringify({ pin40: !sideMini, fold: foldGroups, fund: fundOpen })); } catch { /* bỏ qua */ }
  }, [sideMini, foldGroups, fundOpen]);
  const sideOpen = !sideMini;
  const toggleSide = () => setSideMini((v) => !v);
  const toggleGroup = (id: string) => setFoldGroups((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  // Ctrl/⌘ + K mở bảng lệnh, Ctrl/⌘ + B thu gọn sidebar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((v) => !v); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b' && !(e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"]'))) { e.preventDefault(); toggleSide(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.action ? 7000 : 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const platformUser = platformAdmins.find((u) => u.id === platformId);
  /** Tài khoản nền tảng đăng nhập vào doanh nghiệp với quyền BOD, không lưu vào danh sách nhân sự của doanh nghiệp */
  const allUsers = platformUser ? [...users, platformUser] : users;
  const me = allUsers.find((u) => u.id === sessionId) ?? null;
  const role: Role = me?.role ?? 'SALES_REP';
  // Module bị 3A tắt (hoặc vai trò không được xem) trong lúc đang mở: quay về Tổng quan, menu đã tự ẩn
  useEffect(() => {
    if (!me || consoleView) return;
    if (!(seeModule(page) && moduleEnabled(company, page))) setPage('home');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, company, me?.id, role, consoleView, perms]);

  // ---- Quỹ theo năm: bản ghi của năm đang xem; spent / committed tính lại từ chương trình & claim ----
  // Năm tài chính = năm của bộ lọc thời gian trên header (một nguồn duy nhất)
  const fy = Number(range.from.slice(0, 4));
  const latestBudget = [...budgets].sort((a, b) => b.fiscalYear - a.fiscalYear)[0] ?? INITIAL_BUDGET;
  const storedBudget: Budget = budgets.find((b) => b.fiscalYear === fy)
    ?? { ...latestBudget, fiscalYear: fy, mdfTotal: 0, csTotal: 0, total: 0, allocations: {}, openingSpent: 0, periodStart: `${fy}-01-01`, periodEnd: `${fy}-12-31`, note: '', declared: false };
  const usage = fundUsage(storedBudget.fiscalYear, programs, claims);
  const budget: Budget = { ...storedBudget, spent: (storedBudget.openingSpent ?? 0) + usage.spent, committed: usage.committed };
  const setBudget: Dispatch<SetStateAction<Budget>> = (u) =>
    setBudgets((list) => list.map((b) => (b.fiscalYear === storedBudget.fiscalYear ? (typeof u === 'function' ? (u as (p: Budget) => Budget)(b) : u) : b)));
  const setFiscalYear = (y: number) => setRange(periodRange('YEAR', y));

  // Đồng bộ danh mục cấu hình vào bảng tra cứu trước khi render các phân hệ (phân bổ theo năm đang xem)
  syncCatalog({ segments, tiers: tierRules, categories: categories.map((c) => ({ ...c, amount: storedBudget.declared === false ? 0 : storedBudget.allocations?.[c.code] ?? c.amount })), popDocs, sources });
  const segRules: SegmentRules = Object.fromEntries(segments.map((x) => [x.code, x]));
  /** Bộ lọc toàn cục: chi nhánh (miền), phòng ban, dòng sản phẩm (thương hiệu SKU trong BOQ) */
  const brandOf = (code: string) => skus.find((x) => x.sku === code)?.brand;
  const gfLead = (l: Lead) => (gf.region === 'ALL' || l.region === gf.region) && (gf.dept === 'ALL' || l.dept === gf.dept) && (gf.brand === 'ALL' || !!l.boqItems?.some((b) => brandOf(b.code) === gf.brand));
  /** Phạm vi lead theo vai trò (+ bộ lọc toàn cục) */
  /** Phạm vi dữ liệu: ngoại lệ tài khoản > cấu hình vai trò > mặc định (BOD, Marketing toàn bộ; Trưởng phòng theo phòng; Sales của mình; Kế toán đơn đã chốt) */
  const scope: DataScope = (me && (perms.users?.[me.id]?.scope ?? perms.scope?.[role])) || DEFAULT_SCOPE[role];
  const myLeads = (!me ? [] : scope === 'ALL' ? leads
    : scope === 'DEPT' ? leads.filter((l) => l.dept === me.dept)
    : scope === 'OWN' ? leads.filter((l) => l.assignee === me.id)
    : leads.filter((l) => l.status === 'WON')).filter(gfLead);
  /** Phạm vi khách hàng: của mình = khách phụ trách (AM, đơn hàng, lead được giao); phòng ban = khách của phòng */
  const myCustomers = !me ? [] : scope === 'OWN'
    ? customers.filter((c) => c.amId === me.id || jobs.some((j) => j.customerId === c.id && j.ownerId === me.id) || leads.some((l) => l.assignee === me.id && (l.customerId === c.id || (!!l.taxCode && l.taxCode === c.taxCode))))
    : scope === 'DEPT' ? customers.filter((c) => c.dept === me.dept || users.find((u) => u.id === c.amId)?.dept === me.dept || jobs.some((j) => j.customerId === c.id && j.dept === me.dept))
    : customers;
  const myCustomersF = myCustomers.filter((c) => (gf.region === 'ALL' || c.region === gf.region) && (gf.dept === 'ALL' || c.dept === gf.dept));
  /** Trạng thái hoạt động: ghi lastActiveAt mỗi phút khi người dùng còn thao tác (đồng bộ cho đồng nghiệp thấy online / vắng) */
  const lastInput = useRef(Date.now());
  useEffect(() => {
    const bump = () => { lastInput.current = Date.now(); };
    const evs = ['mousemove', 'keydown', 'pointerdown', 'scroll'] as const;
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);
  useEffect(() => {
    if (!me || !users.some((u) => u.id === me.id)) return;
    const beat = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastInput.current > 5 * 60000) return;
      setUsers((p) => p.map((u) => (u.id === me.id && Date.now() - (u.lastActiveAt ?? 0) > 55000 ? { ...u, lastActiveAt: Date.now() } : u)));
    };
    beat();
    const t = window.setInterval(beat, 60000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);
  /** Chat: tin chưa đọc ở kênh chung, kênh mình từng tham gia hoặc tin nhắc tên mình */
  const seenKey = `3a:ui:seen:${orgId}:${me?.id ?? ''}`;
  useEffect(() => { try { setSeen(JSON.parse(localStorage.getItem(seenKey) ?? '{}') as Record<string, number>); } catch { setSeen({}); } }, [seenKey]);
  const markSeen = (k: string) => setSeen((p) => { const n = { ...p, [k]: Date.now() }; try { localStorage.setItem(seenKey, JSON.stringify(n)); } catch { /* bỏ qua */ } return n; });
  const chatUnread = !me ? 0 : comments.filter((c) => {
    if (c.authorId === me.id) return false;
    const k = `${c.entity}:${c.entityId}`;
    const mine = k === 'channel:general' || c.mentions.includes(me.id) || (c.entity === 'channel' && (c.entityId.startsWith('dm:') ? c.entityId.split(':').includes(me.id) : !!channels.find((g) => g.id === c.entityId)?.members.includes(me.id))) || comments.some((x) => x.authorId === me.id && x.entity === c.entity && x.entityId === c.entityId);
    return mine && c.at > (seen[k] ?? 0);
  }).length;
  // Thông báo trình duyệt khi có tin mới gửi tới mình trong lúc tab đang ẩn (người dùng đã cho phép)
  const notifMark = useRef(0);
  useEffect(() => {
    if (!me) return;
    const fresh = comments.filter((c) => c.authorId !== me.id && c.at > notifMark.current && (c.mentions.includes(me.id) || (c.entity === 'channel' && c.entityId.startsWith('dm:') && c.entityId.split(':').includes(me.id))));
    const first = notifMark.current === 0;
    notifMark.current = Math.max(notifMark.current, ...comments.map((c) => c.at), Date.now() - 1000);
    if (first || !fresh.length || typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return;
    const c = fresh[fresh.length - 1];
    try { new Notification(`${allUsers.find((u) => u.id === c.authorId)?.name ?? 'Đồng nghiệp'} nhắn bạn`, { body: c.text.slice(0, 140) || 'Đã gửi file', tag: 'chat' }); } catch { /* bỏ qua */ }
  }, [comments, me?.id]);
  /** Thông báo: BOD & Marketing xem tất cả, người khác chỉ xem thông báo gửi tới mình */
  const myNotices = !me ? notices : notices.filter((n) => (n.toIds ? n.toIds.includes(me.id) : !n.to || role === 'BOD' || n.to.split(', ').includes(me.name)));

  useEffect(() => {
    if (sessionId && me && !me.active) { if (CLOUD_ON) { logout(); setToast({ msg: 'Tài khoản đã bị khóa. Liên hệ Giám đốc.', tone: 'red' }); } else setSessionId(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, me]);

  useEffect(() => {
    if (me && (!seeModule(page) || !moduleEnabled(company, page))) setPage(MODULES.find((m) => seeModule(m) && moduleEnabled(company, m)) ?? 'overview');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, role, page, perms, company]);

  const notify = (msg: string, tone: ToastT['tone'] = 'teal', action?: ToastT['action']) => setToast({ msg, tone, action, id: Date.now() });
  const userName = (id?: string) => (id === 'ai-bot' ? 'Trợ lý AI' : allUsers.find((u) => u.id === id)?.name ?? 'Chưa giao');
  const dept = (code?: DeptCode) => departments.find((d) => d.code === code);
  const routableDepts = departments.filter((d) => d.active && d.receivesLeads);
  const addMsgLog = (l: Omit<MsgLog, 'id' | 'at'>) => setMsgLogs((p) => [{ ...l, id: uid('m'), at: Date.now() }, ...p].slice(0, 120));

  // =================================================================
  //  THÔNG BÁO ĐA KÊNH: in-app + Zalo ZNS + Email theo quy tắc cấu hình
  //  (bản demo ghi nhật ký; production gọi Zalo ZNS API / SMTP ở server)
  // =================================================================
  const dispatch: AppCtx['dispatch'] = (event, p) => {
    const channels = notifyRules[event] ?? INITIAL_NOTIFY_RULES[event] ?? ['INAPP'];
    const l = p.lead;
    const d = l ? departments.find((x) => x.code === l.dept) : undefined;
    const head = d?.headId ? users.find((u) => u.id === d.headId && u.active) : undefined;
    const rep = l?.assignee ? users.find((u) => u.id === l.assignee) : undefined;
    const mkt = users.find((u) => u.role === 'MKT_LEAD' && u.active);
    let to: User[] = [];
    let kind: NoticeKind = 'SYSTEM';
    let module = p.module;
    let title = p.title ?? '';
    let body = p.body ?? '';
    if (event === 'LEAD_ROUTED' && l) {
      to = head ? [head] : []; kind = 'LEAD'; module = 'leads';
      title = title || `Lead mới chia về ${d?.name ?? 'phòng ban'}`;
      body = body || `${l.company}${l.boqValue ? `, BOQ ${compact(l.boqValue)}` : ''}. Chờ Trưởng phòng chỉ định Sales.`;
    } else if (event === 'LEAD_ASSIGNED' && l) {
      to = rep ? [rep] : []; kind = 'LEAD'; module = 'leads';
      title = title || `Bạn được chỉ định lead ${l.code}`;
      body = body || `${l.company}: tiếp nhận trong ${d?.slaMinutes ?? 120} phút.`;
    } else if (event === 'SLA_BREACH' && l) {
      to = head ? [head] : []; kind = 'SLA'; module = 'leads';
      title = title || 'Quá hạn SLA tiếp nhận 2 giờ';
      body = body || `${l.company} chưa được ${rep?.name ?? 'Sales'} tiếp nhận.`;
    } else if (event === 'QUOTE_OVERDUE' && l) {
      to = [head, rep].filter((u): u is User => !!u); kind = 'QUOTE'; module = 'projects';
      const lateH = l.quoteDeadline ? Math.ceil((Date.now() - l.quoteDeadline) / 3.6e6) : 0;
      title = title || `Quá hạn báo giá: ${l.company}`;
      body = body || `Trễ ${lateH} giờ so với SLA 24 giờ. Đã leo thang tới Trưởng phòng ${head?.name ?? ''}.`;
    } else if (event === 'ACTIVITY_APPROVAL') {
      module = 'tasks';
      const bods = users.filter((u) => u.active && u.role === 'BOD');
      to = (p.toAll ?? [p.to, ...bods]).filter((u, i, arr): u is User => !!u && arr.findIndex((x) => x?.id === u.id) === i);
      kind = 'SYSTEM'; module = 'tasks';
    } else if (event === 'CONTRACT_APPROVAL') {
      const bods = users.filter((u) => u.active && u.role === 'BOD');
      to = (p.toAll ?? [head, ...bods]).filter((u, i, arr): u is User => !!u && arr.findIndex((x) => x?.id === u.id) === i);
      kind = 'DOC'; module = 'tasks';
    } else if (event === 'STOCK_RELEASE') {
      const bods = users.filter((u) => u.active && u.role === 'BOD');
      to = [head, ...bods].filter((u, i, arr): u is User => !!u && arr.findIndex((x) => x?.id === u.id) === i);
      kind = 'STOCK'; module = 'tasks';
      title = title || 'Chờ xác nhận giải phóng hàng giữ chỗ';
      body = body || (l ? `${l.company}: dự án Trượt, hàng giữ chỗ trong kho chờ Trưởng phòng / Giám đốc xác nhận trả về tồn hoặc chuyển dự án khác.` : 'Có yêu cầu trả hàng giữ chỗ về tồn tự do.');
    } else if (event === 'QUOTE_APPROVAL' || event === 'PROGRAM_APPROVAL') {
      const bods = users.filter((u) => u.active && u.role === 'BOD');
      to = (p.toAll ?? [head, ...bods]).filter((u, i, arr): u is User => !!u && arr.findIndex((x) => x?.id === u.id) === i);
      kind = event === 'QUOTE_APPROVAL' ? 'QUOTE' : 'CLAIM'; module = 'tasks';
    } else if (event === 'APPROVAL_RESULT') {
      to = p.to ? [p.to] : []; module = module ?? 'tasks';
    } else if (event === 'CLAIM_UPDATE') {
      to = p.to ? [p.to] : mkt ? [mkt] : []; kind = 'CLAIM'; module = module ?? 'claims';
    }

    if (channels.includes('INAPP')) {
      setNotices((n) => [{ id: uid('n'), at: Date.now(), kind, title, body, read: false, module, to: to.map((u) => u.name).join(', ') || undefined, toIds: to.length ? to.map((u) => u.id) : undefined }, ...n].slice(0, 80));
      setRingKey((k) => k + 1);
    }
    const sent: string[] = [];
    const tplKey = event as ZnsTemplateKey;
    if (channels.includes('ZNS') && zns.templates[tplKey] !== undefined) {
      for (const u of to) {
        const ok = zns.enabled && !!u.phone;
        addMsgLog({ channel: 'ZNS', to: u.phone ? znsPhone(u.phone) : u.name, subject: `Mẫu ${zns.templates[tplKey]}: ${title}`, ok, detail: ok ? `Gửi ${u.name} qua OA ${zns.oaId}` : !zns.enabled ? 'Kênh ZNS đang tắt' : 'Nhân sự chưa có số điện thoại' });
        if (ok) sent.push(`Zalo ZNS tới ${u.name}`);
      }
    }
    if (channels.includes('EMAIL')) {
      for (const u of to) {
        const ok = emailCfg.enabled && !!emailCfg.password;
        addMsgLog({ channel: 'EMAIL', to: u.email, subject: `[${company.appName}] ${title}`, ok, detail: ok ? `Gửi qua ${EMAIL_PRESET[emailCfg.provider].label}` : 'Kênh Email chưa sẵn sàng' });
        if (ok) sent.push(`Email ${u.email}`);
      }
    }
    return sent;
  };

  // =================================================================
  //  GETFLY (bản demo mô phỏng; production gọi src/server/actions/getfly.ts)
  // =================================================================
  const addGetflyLog = (l: Omit<GetflyLog, 'id' | 'at'>) => setGetflyLogs((p) => [{ ...l, id: uid('g'), at: Date.now() }, ...p].slice(0, 100));

  const recomputeLinked = (orders: GetflyOrderRec[], ids?: string[]) =>
    setCustomers((p) =>
      p.map((c) => {
        if (!c.getflyAccountId || (ids && !ids.includes(c.id))) return c;
        const f = financialsFromOrders(c.id, orders, budget.fiscalYear);
        return { ...c, ytdRevenue: (c.baseline?.revenue ?? 0) + f.ytd, debt: (c.baseline?.debt ?? 0) + f.debt };
      }),
    );

  /**
   * Tạo đơn Getfly từ phiên bản báo giá đã chốt (lead.wonQuoteId).
   * Bản demo mô phỏng phản hồi; production gọi server action syncWonProjectToGetfly với cùng payload.
   */
  const pushToGetfly = async (lead: Lead, cust: Customer) => {
    if (lead.getflySync?.status === 'SYNCED' || lead.getflySync?.status === 'PENDING') return;
    const patchLead = (sync: Lead['getflySync']) => setLeads((p) => p.map((x) => (x.id === lead.id ? { ...x, getflySync: sync } : x)));
    const quote = quotes.find((q) => q.id === lead.wonQuoteId);
    const fail = (msg: string) => {
      patchLead({ status: 'FAILED', error: msg, at: Date.now(), quoteId: quote?.id });
      addGetflyLog({ direction: 'OUT', title: `Tạo đơn cho ${lead.code}`, ok: false, detail: msg });
      notify(`Đồng bộ Getfly thất bại: ${msg}`, 'red');
    };
    if (!quote || !quote.lines.length) return fail('Chưa có phiên bản báo giá được chốt (có dòng sản phẩm). Mở dự án, chốt lại theo báo giá.');
    const unknownSku = quote.lines.filter((l) => !skus.some((k) => k.sku === l.sku)).map((l) => l.sku);
    patchLead({ status: 'PENDING', at: Date.now(), quoteId: quote.id });
    await new Promise((r) => setTimeout(r, 900));
    const cfgErr = !getfly.isActive ? 'Kết nối Getfly đang tắt'
      : getfly.demoMode ? ''
      : !/^https:\/\/.+/.test(getfly.baseUrl) ? 'Chưa cấu hình Getfly Base URL'
      : !/^[A-Za-z0-9]{30}$/.test(getfly.apiKey) ? 'API Key không hợp lệ hoặc không đủ quyền (HTTP 401)' : '';
    if (cfgErr) return fail(cfgErr);
    // B1: khách hàng trên Getfly — đã liên kết thì dùng lại, chưa thì (mô phỏng) dò MST / SĐT rồi tạo mới
    const created = !cust.getflyAccountId;
    const accountId = cust.getflyAccountId ?? 30200 + customers.length + Math.floor(Math.random() * 700);
    const accountCode = cust.getflyAccountCode ?? `KH${accountId}`;
    // B2: dựng đơn từ báo giá đã chốt
    const { payload, totals } = buildGetflyPayload(lead, quote, { code: accountCode, name: cust.name, phone: cust.contactPhone }, company.appName, todayISO());
    orderSeq.current += 1;
    const orderId = orderSeq.current;
    const order: GetflyOrderRec = {
      orderId, orderCode: `DH${orderId}`, customerId: cust.id, orderDate: todayISO(), gross: totals.gross, vat: totals.vat, net: totals.sub, paid: 0, approved: false,
      source: 'MDF_APP', leadCode: lead.code, lines: quote.lines.length, products: quote.lines.map((l) => ({ code: l.sku, name: l.name, qty: l.qty, price: lineNet(l) })),
    };
    setGetflyOrders((p) => [order, ...p]);
    if (created) setCustomers((p) => p.map((c) => (c.id === cust.id ? { ...c, getflyAccountId: accountId, getflyAccountCode: accountCode, baseline: { revenue: c.ytdRevenue, debt: c.debt } } : c)));
    patchLead({ status: 'SYNCED', orderCode: order.orderCode, accountCode, at: Date.now(), quoteId: quote.id, payload });
    addGetflyLog({
      direction: 'OUT', title: `Tạo đơn cho ${lead.code}`, ok: true,
      detail: `${created ? `Không thấy theo MST / SĐT, tạo khách ${accountCode}` : `Dùng khách ${accountCode}`}; ${order.orderCode} theo ${quote.code} lần ${quote.version}: ${quote.lines.length} dòng, ${vnd(totals.gross)}${getfly.demoMode ? ' (mô phỏng)' : ''}${unknownSku.length ? `. Cảnh báo mã chưa có trong danh mục: ${unknownSku.join(', ')}` : ''}`,
    });
    notify(`Đã tạo ${order.orderCode} trên Getfly từ báo giá ${quote.code} (${compact(totals.gross)}). Doanh số ghi nhận khi Getfly duyệt đơn.`, 'teal');
  };

  /**
   * Chốt đơn theo một phiên bản báo giá: ghi nhận doanh số (trước VAT) ngay khi chốt.
   * Chưa tự đẩy đơn sang Getfly (tích hợp sẽ bật sau); dữ liệu đơn xem trước được ở ngăn dự án.
   */
  const winLead = (id: string, quoteId: string) => {
    const l = leads.find((x) => x.id === id);
    const q = quotes.find((x) => x.id === quoteId && x.leadId === id);
    if (!l || !q || !q.lines.length) return notify('Chọn phiên bản báo giá có dòng sản phẩm để chốt đơn', 'red');
    const existing = customers.find((c) => c.id === l.customerId) ?? findByTax(customers, l.taxCode);
    let cust: Customer;
    if (existing) {
      cust = existing;
      setCustomers((p) => p.map((c) => (c.id === existing.id ? { ...c, ytdRevenue: c.ytdRevenue + q.amount, status: 'ACTIVE' } : c)));
    } else {
      const src = sourceFromChannel(l.source);
      cust = {
        ...EMPTY_CUSTOMER, id: uid('k'), code: nextCode(customers.map((c) => c.code), 'KH-', 6), name: l.company, taxCode: l.taxCode ?? '',
        segment: l.segment, region: l.region, dept: l.dept ?? routableDepts[0]?.code ?? '', amId: l.assignee, contactName: l.contact, contactPhone: l.phone,
        contactEmail: l.email ?? '', ytdRevenue: q.amount, sourceId: sources.some((x) => x.id === src) ? src : sources[0]?.id ?? '',
        tier: TIERS[TIERS.length - 1] ?? '', status: 'ACTIVE', createdAt: todayISO(),
      };
      setCustomers((p) => [...p, cust]);
    }
    // Đơn được xếp hàng đồng bộ Getfly (gửi khi tích hợp được bật)
    const won: Lead = { ...l, status: 'WON', customerId: cust.id, boqStatus: 'DONE', lostReason: undefined, lostNote: undefined, wonQuoteId: q.id, wonAt: todayISO(), wonAmount: q.amount, getflySync: l.getflySync?.status === 'SYNCED' ? l.getflySync : { status: 'QUEUED', at: Date.now(), quoteId: q.id } };
    setLeads((p) => p.map((x) => (x.id === id ? won : x)));
    setQuotes((p) => p.map((x) => (x.leadId !== id ? x : x.id === q.id ? { ...x, status: 'ACCEPTED' } : x.status === 'SENT' ? { ...x, status: 'REVISED' } : x)));
    const so = saleFromQuote(q, cust, l.id);
    notify(`Chốt đơn ${l.company} theo ${q.code}: ghi nhận doanh số ${compact(q.amount)} (trước VAT)${existing ? '' : `, tạo khách hàng ${cust.code}`}${saleWord(so)}`, 'teal', so ? { label: 'Xem đơn bán', run: () => { setOpenSale(so.o.id); setPage('sales'); } } : undefined);
  };

  /** Báo giá nháp của khách lẻ: khi khách đồng ý thì tạo khách hàng trong CRM (hoặc dùng khách trùng tên + điện thoại) */
  const winDraftQuote = (quoteId: string) => {
    const q = quotes.find((x) => x.id === quoteId);
    const p = q?.quoteForm?.party;
    if (!q || !p || !q.lines.length) return notify('Báo giá chưa có khách hoặc dòng hàng', 'red');
    const phone = p.phone.replace(/\D/g, '');
    const existing = customers.find((c) => c.id === q.customerId) ?? customers.find((c) => fold(c.name) === fold(p.name) && (!phone || c.contactPhone.replace(/\D/g, '') === phone));
    let cust: Customer;
    if (existing) {
      cust = existing;
      setCustomers((all) => all.map((c) => (c.id === existing.id ? { ...c, ytdRevenue: c.ytdRevenue + q.amount, status: 'ACTIVE' } : c)));
    } else {
      cust = {
        ...EMPTY_CUSTOMER, id: uid('k'), code: nextCode(customers.map((c) => c.code), 'KH-', 6), name: p.name, taxCode: '', dept: me?.dept ?? routableDepts[0]?.code ?? EMPTY_CUSTOMER.dept,
        amId: q.createdBy ?? me?.id, contactName: p.rep || p.name, contactTitle: p.repTitle, contactPhone: p.phone, contactEmail: p.email, address: p.address,
        ytdRevenue: q.amount, tier: TIERS[TIERS.length - 1] ?? EMPTY_CUSTOMER.tier, status: 'ACTIVE', createdAt: todayISO(),
      };
      setCustomers((all) => [...all, cust]);
    }
    setQuotes((all) => all.map((x) => (x.id === q.id ? { ...x, status: 'ACCEPTED' as QuoteStatus, customerId: cust.id, draft: false } : x)));
    if (me) writeAudit('QUOTE_WIN', `Chốt báo giá nháp ${q.code}: ${p.name}${existing ? '' : `, thêm khách ${cust.code}`}`, 'INFO', realUserId ?? me.id);
    const so = saleFromQuote(q, cust, q.leadId || undefined);
    notify(`Đã ghi nhận chốt ${q.code}: ${compact(q.amount)} trước VAT${existing ? `, khách ${cust.code} đã có trong CRM` : `, đã thêm khách ${cust.code} vào CRM`}${saleWord(so)}`, 'teal', so ? { label: 'Xem đơn bán', run: () => { setOpenSale(so.o.id); setPage('sales'); } } : undefined);
  };

  // ---------------- v48: quy trình & phê duyệt ----------------
  const wfAll = useMemo(() => wfMerge(wfDefs), [wfDefs]);
  const wfDef = (key: string) => wfAll.find((d) => d.key === key);
  const wfCtx = (): WfCtx => ({ users, departments, warehouses, activities, delegations: wfDelegations, policy: wfPolicy, perms, me: me ?? undefined, now: Date.now() });
  const wfDecide = (o: WfDecideArgs) => {
    if (!me) return;
    const def = wfDef(o.key);
    const step = o.steps[o.idx];
    const last = o.idx >= o.steps.length - 1;
    const dec: WfDecision = { step: o.idx, by: me.id, decision: o.decision, note: o.note, at: Date.now(), onBehalf: o.onBehalf, self: o.self };
    const run = wfRuns.find((r) => r.key === o.key && r.refId === o.refId && r.status === 'PENDING');
    const status: WfRunStatus = o.decision === 'APPROVED' ? (last ? 'APPROVED' : 'PENDING') : o.decision;
    if (run) setWfRuns((all) => all.map((r) => (r.id === run.id ? { ...r, decisions: [...r.decisions, dec], status, doneAt: status === 'PENDING' ? undefined : Date.now() } : r)));
    else if (!last || o.steps.length > 1) setWfRuns((all) => [{ id: uid('wr'), key: o.key, refId: o.refId, version: def?.version ?? 1, steps: o.steps, decisions: [dec], status, startedAt: Date.now() }, ...all].slice(0, 3000));
    const behalf = o.onBehalf ? ` (thay ${users.find((u) => u.id === o.onBehalf)?.name ?? ''})` : '';
    if (o.self) writeAudit('WF_SELF_APPROVE', `Tự duyệt (Giám đốc duy nhất): ${o.title}`, 'WARN', realUserId ?? me.id);
    if (o.decision === 'APPROVED' && !last) {
      setApprovalLogs((p) => [{ id: uid('al'), kind: o.kind, refId: o.refId, title: o.title, requesterId: o.subject.requesterId, deciderId: me.id, decision: 'APPROVED' as ApprovalDecision, note: `Bước ${o.idx + 1}/${o.steps.length}: ${step?.name ?? ''}${behalf}`, at: Date.now(), amount: o.subject.amount }, ...p].slice(0, 2000));
      const next = o.steps[o.idx + 1];
      const who = next ? wfApprovers(next, o.subject, wfCtx()).map((x) => x.u) : [];
      who.filter((u) => u.id !== me.id).forEach((u) => dispatch('APPROVAL_RESULT', { to: u, title: `Chờ bạn duyệt bước ${o.idx + 2}: ${o.title}`, body: `${next?.name ?? ''}. Bước ${o.idx + 1} đã duyệt bởi ${me.name}${behalf}`, module: 'tasks' }));
      notify(`Đã duyệt bước ${o.idx + 1}/${o.steps.length}${behalf}, chuyển ${next?.name ?? 'bước sau'}${who.length ? `: ${who.map((u) => u.name).join(', ')}` : ''}`, 'teal');
      return;
    }
    if (o.decision === 'APPROVED') o.final?.();
    else if (o.decision === 'REJECTED') o.reject?.(o.note ?? '');
    else o.needInfo?.(o.note ?? '');
  };

  const [reqOpen, setReqOpen] = useState<string | null>(null);
  useEffect(() => { setReqOpen(null); setOpenSale(null); }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps
  const wfFirstApprovers = (key: string, s: WfSubject) => { const d = wfDef(key); const st = d ? wfPath(d, s)[0] : undefined; return st ? wfApprovers(st, s, wfCtx()).map((x) => x.u) : []; };
  const tellApprovers = (who: User[], title: string, body: string) => who.filter((u) => u.id !== me?.id).forEach((u) => dispatch('APPROVAL_RESULT', { to: u, title, body, module: 'tasks' }));
  const wfSubmit: AppCtx['wfSubmit'] = (key, title, form, files, runId) => {
    const d = wfDef(key);
    if (!d || !me) return null;
    const s: WfSubject = { requesterId: me.id, dept: me.dept, amount: wfAmountOf(d, form), vals: wfFormVals(d, form) };
    const steps = wfPath(d, s);
    const auto = d.trigger.length > 0 && !wfNeeds(d, s);
    const old = runId ? wfRuns.find((r) => r.id === runId) : undefined;
    const year = new Date().getFullYear();
    const prefix = `${(d.prefix || 'DN').toUpperCase()}-${year}-`;
    const code = old?.code ?? nextCode(wfRuns.filter((r) => r.code?.startsWith(prefix)).map((r) => r.code!), prefix, 4);
    const rid = old?.id ?? uid('wr');
    const run: WfRun = { id: rid, key, refId: rid, version: d.version, steps, decisions: [], status: auto ? 'APPROVED' : 'PENDING', startedAt: Date.now(), code, title: title.trim() || d.name, requesterId: me.id, dept: me.dept, amount: s.amount, form, files, doneAt: auto ? Date.now() : undefined };
    setWfRuns((all) => (old ? all.map((r) => (r.id === old.id ? run : r)) : [run, ...all]));
    if (auto) { setTimeout(() => wfAfter(run, d), 0); notify(`${code}: không cần duyệt theo điều kiện của quy trình, đã hoàn tất`, 'teal'); return run; }
    tellApprovers(wfApprovers(steps[0], s, wfCtx()).map((x) => x.u), `Đề nghị chờ duyệt: ${run.title}`, `${code} của ${me.name}${s.amount ? `, ${vnd(s.amount)}` : ''}. ${steps[0].name}`);
    notify(`${old ? 'Đã gửi lại' : 'Đã gửi'} ${code}: ${steps.map((x) => x.name).join(' → ')}`, 'teal');
    return run;
  };
  const wfAfter = (r: WfRun, d: WfDef) => {
    const after = d.after ?? ['NOTIFY'];
    const req = users.find((u) => u.id === r.requesterId);
    if (after.includes('NOTIFY') && req && req.id !== me?.id) dispatch('APPROVAL_RESULT', { to: req, title: `Đã duyệt: ${r.code} ${r.title ?? ''}`, body: `${d.name} đã duyệt xong`, module: 'tasks' });
    if (after.includes('NOTIFY_USER') && d.notifyUserId) { const u = users.find((x) => x.id === d.notifyUserId && x.active); if (u) dispatch('APPROVAL_RESULT', { to: u, title: `Đề nghị đã duyệt: ${r.code} ${r.title ?? ''}`, body: `${req?.name ?? ''}${r.amount ? `, ${vnd(r.amount)}` : ''}`, module: 'tasks' }); }
    if (after.includes('CASH_OUT') && r.amount) postCash({ kind: 'OUT', account: 'BANK', category: 'Chi theo đề nghị', amount: r.amount, partner: req?.name, ref: r.code, note: `${d.name}: ${r.title ?? ''}`, source: 'REQUEST', sourceId: r.id });
  };
  const wfFinishRequest = (runId: string) => {
    const r = wfRuns.find((x) => x.id === runId);
    const d = r ? wfDef(r.key) : undefined;
    if (!r || !d) return;
    setWfRuns((all) => all.map((x) => (x.id === runId ? { ...x, status: 'APPROVED', doneAt: Date.now() } : x)));
    setApprovalLogs((p) => [{ id: uid('al'), kind: 'REQUEST' as ApprovalKind, refId: r.id, title: `${r.code}: ${r.title ?? ''}`, requesterId: r.requesterId, deciderId: me?.id ?? '', decision: 'APPROVED' as ApprovalDecision, at: Date.now(), amount: r.amount }, ...p].slice(0, 2000));
    wfAfter(r, d);
    notify(`Đã duyệt xong ${r.code}${(d.after ?? []).includes('CASH_OUT') && r.amount ? `, tự sinh phiếu chi ${vnd(r.amount)}` : ''}`, 'teal');
  };
  const approveVoucher = (id: string) => {
    const v0 = stockVouchers.find((x) => x.id === id);
    if (!v0 || v0.status !== 'PENDING') return false;
    const v: StockVoucher = { ...v0, lines: v0.lines.map((l) => ({ ...l })) };
    const r = applyVoucher(v, 1, skus, warehouses, me?.id);
    if (r.error) { notify(r.error, 'red'); return false; }
    setSkus(r.skus); addMoves(r.moves);
    setStockVouchers((all) => all.map((x) => (x.id === id ? { ...v, status: 'DONE', approvedBy: me?.id, approvedAt: Date.now() } : x)));
    return true;
  };

  // ---------------- v46: đơn bán ----------------
  const [openSale, setOpenSale] = useState<string | null>(null);
  const canAct = (a: Action) => myPerm?.actions?.[a] ?? (perms.actions[a] ?? INITIAL_PERMS.actions[a] ?? []).includes(role);
  const saleCode = (all: SalesOrder[]) => {
    const d = new Date();
    const p = `DB-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-`;
    return nextCode(all.filter((x) => x.code.startsWith(p)).map((x) => x.code), p, 4);
  };
  const mainWhId = () => warehouses.find((w) => w.main)?.id ?? MAIN_WH;
  const saveSale: AppCtx['saveSale'] = (o) => {
    let approval = o.approval;
    if (!o.id && o.source === 'COUNTER' && !approval) {
      const d = wfDef('SALE');
      const grand = saleTotals(o).grand;
      const cust = customers.find((c) => c.id === o.customerId);
      const owe = salesOrders.filter((x) => !!o.customerId && x.customerId === o.customerId && saleIssued(x)).reduce((s, x) => s + saleTotals(x).grand - salePaid(x), 0);
      const credit = o.pay === 'CREDIT' || o.pay === 'PARTIAL';
      const overLimit = cust && cust.creditLimit > 0 && credit ? Math.max(0, owe + grand - cust.creditLimit) : 0;
      const s: WfSubject = { requesterId: me?.id, dept: cust?.dept, amount: grand, vals: { maxDisc: Math.max(0, ...o.lines.map((l) => l.discountPct)), overLimit, amount: grand } };
      if (d && wfNeeds(d, s)) {
        approval = { status: 'PENDING', reasons: wfReasons(d, s), requestedAt: Date.now(), requestedBy: me?.id };
        tellApprovers(wfApprovers(wfPath(d, s)[0], s, wfCtx()).map((x) => x.u), `Đơn bán chờ duyệt: ${o.customer}`, `${fmtN(grand)} sau VAT. ${approval.reasons.join('; ')}`);
      }
    }
    const rec: SalesOrder = { ...o, approval, id: o.id ?? uid('so'), code: o.code ?? saleCode(salesOrders), createdAt: o.createdAt ?? Date.now() };
    setSalesOrders((all) => (all.some((x) => x.id === rec.id) ? all.map((x) => (x.id === rec.id ? rec : x)) : [rec, ...all]));
    return rec;
  };
  const stockData = (): SaleStockData => ({ skus, warehouses, reservations, stockMoves, orders: salesOrders });
  /** Báo giá được chốt: tạo đơn bán (giữ hàng mềm cho mã đủ tồn, báo phần thiếu để đề xuất mua) */
  const saleFromQuote = (q: Quote, cust: Customer, leadId?: string) => {
    if (salesOrders.some((o) => o.quoteId === q.id && o.status !== 'CANCELLED')) return null;
    const f = q.quoteForm;
    const mfg = bizMode(company) === 'MFG';
    const lines: SaleLine[] = q.lines.filter((l) => l.qty > 0).map((l) => {
      const k = l.sku ? skus.find((x) => x.sku === l.sku) : undefined;
      const it = !k && mfg ? stockItems.find((x) => x.active && ((!!l.sku && x.code === l.sku) || fold(x.name) === fold(l.name))) : undefined;
      return { id: uid('sl'), kind: k ? 'SKU' : it ? 'ITEM' : 'FREE', ref: k?.sku ?? it?.id, name: l.name, unit: l.unit, qty: l.qty, price: l.listPrice, discountPct: l.discountPct, vat: l.vat ?? q.vatPct, note: l.note };
    });
    const credit = f?.creditDays ?? 0;
    const draft = { date: todayISO(), source: 'QUOTE' as const, quoteId: q.id, leadId, customerId: cust.id, customer: cust.name, phone: cust.contactPhone || f?.party.phone || undefined, taxCode: cust.taxCode || f?.party.taxCode || undefined,
      address: f?.party.address || cust.address || undefined, lines, pay: (credit > 0 ? 'CREDIT' : 'BANK') as SalePay, creditDays: credit, payments: [], delivery: 'DELIVER' as SaleDelivery, whId: mainWhId(),
      invoice: !!(cust.taxCode || f?.party.taxCode), note: `Tự tạo khi chốt ${q.code}`, status: 'PENDING' as SaleStatus, by: me?.id };
    const o = saveSale(draft);
    const short = saleStock(o, stockData()).filter((x) => x.short > 0).length;
    return { o, short };
  };
  const saleWord = (r: ReturnType<typeof saleFromQuote>) => (r ? `. Đã tạo đơn bán ${r.o.code}${r.short ? `, ${r.short} mã thiếu hàng cần đề xuất mua` : ', hàng đủ, đang giữ trong kho'}` : '');

  const issueSale = (id: string, given?: SalesOrder) => {
    const o = given ?? salesOrders.find((x) => x.id === id);
    if (!o || o.status !== 'PENDING') return false;
    if (o.approval && o.approval.status !== 'APPROVED') { notify(o.approval.status === 'PENDING' ? `${o.code} đang chờ duyệt (${o.approval.reasons.join('; ')}), chưa xuất kho được` : `${o.code} không được duyệt`, 'red'); return false; }
    const direct = bizMode(company) === 'MFG' ? canAct('stock.manage') : canAct('stock.approve') || warehouses.find((w) => w.id === o.whId)?.managerId === me?.id;
    if (!direct) {
      if (!canAct('stock.deliver') && !canAct('stock.voucher') && !canAct('job.manage')) { notify('Bạn chưa có quyền xuất kho, báo Thủ kho hoặc Kế toán', 'red'); return false; }
      if (o.issueRequest) { notify(`${o.code} đã gửi yêu cầu xuất kho, đang chờ duyệt`, 'orange'); return false; }
      const lack0 = saleStock(o, stockData()).find((x) => x.short > 0);
      if (lack0) { notify(`${lack0.l.name} còn thiếu ${lack0.short.toLocaleString('vi-VN')} ${lack0.l.unit}: chọn Giao trước phần có sẵn hoặc Đề xuất mua`, 'red'); return false; }
      setSalesOrders((all) => all.map((x) => (x.id === o.id ? { ...x, issueRequest: { by: me?.id ?? '', at: Date.now() } } : x)));
      const s: WfSubject = { requesterId: me?.id, whId: o.whId, amount: saleTotals(o).grand, vals: { amount: saleTotals(o).grand } };
      const who = wfFirstApprovers('VOUCHER', s);
      tellApprovers(who, `Yêu cầu xuất kho: ${o.code}`, `${o.customer}, ${o.lines.length} dòng hàng`);
      notify(`Đã gửi yêu cầu xuất kho ${o.code}${who.length ? ` cho ${who.map((u) => u.name).join(', ')}` : ''}`, 'teal');
      return false;
    }
    const st = saleStock(o, stockData());
    const lack = st.find((x) => x.short > 0);
    if (lack) { notify(`${lack.l.name} còn thiếu ${lack.short.toLocaleString('vi-VN')} ${lack.l.unit}: chọn Giao trước phần có sẵn hoặc Đề xuất mua`, 'red'); return false; }
    const wo = o.woId ? workOrders.find((w) => w.id === o.woId) : undefined;
    if (wo && wo.stage !== 'DONE') { notify(`Chờ xưởng hoàn thành ${wo.code} rồi mới xuất giao`, 'red'); return false; }
    const at = todayISO();
    const refs: string[] = [];
    let resNext = reservations;
    const resMoves: Omit<StockMove, 'id'>[] = [];
    const fromFree = new Map<string, { qty: number; price: number }>();
    for (const x of st) {
      if (x.l.kind !== 'SKU' || !x.l.ref) continue;
      let need = x.l.qty;
      for (const r of saleResOf(o, x.l.ref, resNext)) {
        if (need <= 0) break;
        const q = Math.min(need, r.qty);
        need -= q;
        resNext = resNext.map((y) => (y.id === r.id ? { ...y, qty: y.qty - q, delivered: y.delivered + q, status: y.qty - q === 0 ? 'DELIVERED' : y.status } : y));
        resMoves.push({ at, sku: r.sku, type: 'DELIVER', qty: q, kind: r.kind, refId: r.refId, poId: r.poId, by: me?.id, note: `Xuất bán ${o.code}` });
      }
      if (need > 0) { const c = fromFree.get(x.l.ref); fromFree.set(x.l.ref, { qty: (c?.qty ?? 0) + need, price: x.l.price }); }
    }
    let voucher: StockVoucher | null = null;
    let nextSkus = skus;
    let vMoves: Omit<StockMove, 'id'>[] = [];
    if (fromFree.size) {
      voucher = { id: uid('sv'), code: nextVoucherCode('OUT', stockVouchers), type: 'OUT', status: 'DONE', date: at, whId: o.whId, reason: 'Xuất bán', partner: o.customer, ref: o.code, note: `Đơn bán ${o.code}`,
        lines: [...fromFree.entries()].map(([sku, v]) => ({ sku, qty: v.qty, price: v.price })), requestedBy: me?.id, approvedBy: me?.id, approvedAt: Date.now(), createdAt: Date.now() };
      const r = applyVoucher(voucher, 1, skus, warehouses, me?.id);
      if (r.error) { notify(r.error, 'red'); return false; }
      nextSkus = r.skus; vMoves = r.moves; refs.push(voucher.code);
    }
    const items = st.filter((x) => x.l.kind === 'ITEM' && x.l.ref);
    let inv: InvMove[] = [];
    if (items.length) {
      const code = nextCode(stockMoves.filter((m) => m.type === 'OUT').map((m) => m.code), `PX-${at.slice(0, 4)}-`, 4);
      inv = items.map((x) => ({ id: uid('sm'), code, type: 'OUT' as InvMoveType, date: at, itemId: x.l.ref!, qty: x.l.qty, unitCost: stockOf(x.l.ref!, stockMoves).avg || (stockItems.find((i) => i.id === x.l.ref)?.cost ?? 0), partner: o.customer, note: `Xuất bán ${o.code}`, by: me?.id, at: Date.now() }));
      refs.push(code);
    }
    if (resMoves.length) { setReservations(resNext); refs.push('hàng giữ chỗ'); }
    if (voucher) { const v = voucher; setSkus(nextSkus); setStockVouchers((p) => [v, ...p]); }
    if (resMoves.length || vMoves.length) addMoves([...resMoves, ...vMoves]);
    if (inv.length) setStockMoves((p) => [...inv, ...p]);
    const status: SaleStatus = o.delivery === 'PICKUP' ? 'DONE' : 'SHIPPING';
    setSalesOrders((all) => all.map((x) => (x.id === id ? { ...x, status, issuedAt: Date.now(), issuedBy: me?.id, issueRefs: refs, issueRequest: undefined, doneAt: status === 'DONE' ? Date.now() : x.doneAt } : x)));
    if (me) writeAudit('SALE_ISSUE', `Xuất kho đơn bán ${o.code}${refs.length ? ` (${refs.join(', ')})` : ''}`, 'INFO', realUserId ?? me.id);
    const due = o.creditDays > 0 ? `, ghi công nợ hạn ${fmtDate(addDaysISO(at, o.creditDays))}` : '';
    notify(`Đã xuất kho ${o.code}${voucher ? ` theo ${voucher.code}` : ''}${status === 'DONE' ? ', đơn hoàn thành' : ', chuyển Đang giao'}${due}`, 'teal');
    return true;
  };

  const splitSale = (id: string) => {
    const o = salesOrders.find((x) => x.id === id);
    if (!o || o.status !== 'PENDING') return;
    const st = saleStock(o, stockData());
    const now = st.filter((x) => x.have > 0).map((x) => ({ ...x.l, qty: x.have }));
    const later = st.filter((x) => x.short > 0).map((x) => ({ ...x.l, id: uid('sl'), qty: x.short }));
    if (!later.length) return notify('Đơn đủ hàng, không cần tách', 'teal');
    if (!now.length) return notify('Chưa có mặt hàng nào sẵn để giao trước', 'orange');
    const code = saleCode(salesOrders);
    const rest: SalesOrder = { ...o, id: uid('so'), code, createdAt: Date.now(), lines: later, payments: [], shipFee: 0, splitFrom: o.id, poIds: o.poIds, note: `Phần giao sau của ${o.code}` };
    setSalesOrders((all) => [rest, ...all.map((x) => (x.id === id ? { ...x, lines: now, note: [x.note, `Tách phần thiếu sang ${code}`].filter(Boolean).join(' · ') } : x))]);
    if (me) writeAudit('SALE_SPLIT', `Tách đơn bán ${o.code}: giao trước ${now.length} dòng, phần thiếu sang ${code}`, 'INFO', realUserId ?? me.id);
    notify(`Đã tách: ${o.code} giao phần có sẵn, ${code} chờ hàng về`, 'teal');
  };

  const purchaseForSale = (id: string) => {
    const o = salesOrders.find((x) => x.id === id);
    if (!o || !me) return;
    if (!canAct('po.manage')) return notify('Bạn chưa có quyền lập phiếu đặt hàng, báo Trưởng phòng hoặc Kế toán', 'red');
    const short = saleStock(o, stockData()).filter((x) => x.short > 0 && x.l.kind === 'SKU' && x.l.ref);
    if (!short.length) return notify(saleStock(o, stockData()).some((x) => x.short > 0) ? 'Vật tư thiếu: lập phiếu nhập ở phân hệ Vật tư' : 'Đơn đủ hàng, không cần đặt thêm', 'orange');
    const byVendor = new Map<string, { k: SkuItem; qty: number }[]>();
    for (const x of short) {
      const k = skus.find((s) => s.sku === x.l.ref);
      if (!k) continue;
      const v = (k.supplier || k.brand || 'Nhà cung cấp').trim();
      byVendor.set(v, [...(byVendor.get(v) ?? []), { k, qty: x.short }]);
    }
    let seq = Math.max(0, ...pos.map((p) => Number(p.code.match(/(\d+)$/)?.[1] ?? 0)));
    const d = todayISO();
    const made: VendorPO[] = [...byVendor.entries()].map(([vendor, ls]) => {
      seq += 1;
      const prefix = fold(vendor).replace(/[^a-z0-9]/g, '').slice(0, 6).toUpperCase() || 'NCC';
      const lead = Math.max(0, ...ls.map((x) => x.k.leadTimeDays || 0));
      return {
        id: uid('po'), code: `PO-${prefix}-${d.slice(0, 4)}-${String(seq).padStart(4, '0')}`, vendor, orderDate: d, expectedDate: addDaysISO(d, lead), purpose: o.customerId || o.leadId ? 'MIXED' : 'STOCK',
        note: `Đề xuất từ đơn bán ${o.code} (${o.customer})`, shipments: [], createdBy: me.id,
        lines: ls.map((x) => ({ sku: x.k.sku, qty: x.qty, unitPrice: x.k.costPrice || x.k.dealerPrice || x.k.basePrice, allocations: o.leadId ? [{ kind: 'LEAD' as const, refId: o.leadId, qty: x.qty }] : o.customerId ? [{ kind: 'CUSTOMER' as const, refId: o.customerId, qty: x.qty }] : [] })),
      };
    });
    if (!made.length) return;
    setPos((all) => [...made, ...all]);
    setSalesOrders((all) => all.map((x) => (x.id === id ? { ...x, poIds: [...(x.poIds ?? []), ...made.map((p) => p.id)] } : x)));
    writeAudit('SALE_PO', `Đơn bán ${o.code}: lập ${made.map((p) => p.code).join(', ')} cho phần thiếu`, 'INFO', realUserId ?? me.id);
    notify(`Đã lập ${made.map((p) => p.code).join(', ')}. Hàng về sẽ tự giữ chỗ cho ${o.customer}`, 'teal');
  };

  const saleCash = (o: SalesOrder, p: SalePayment): CashDraft => ({ kind: 'IN', account: p.method === 'CASH' ? 'CASH' : 'BANK', category: 'Thu tiền bán hàng', amount: p.amount, partner: o.customer, ref: o.code, note: `Đơn bán ${o.code}`, source: 'SALE', sourceId: p.id });
  const addSalePayment = (id: string, amount: number, method: 'CASH' | 'BANK', given?: SalesOrder) => {
    const o = given ?? salesOrders.find((x) => x.id === id);
    if (!o || !(amount > 0)) return;
    const ok = canAct('cash.manage') || canAct('receipt.confirm');
    const p: SalePayment = { id: uid('sp'), amount: Math.round(amount), method, at: Date.now(), by: me?.id, confirmed: ok, confirmedBy: ok ? me?.id : undefined, confirmedAt: ok ? Date.now() : undefined };
    setSalesOrders((all) => all.map((x) => (x.id === id ? { ...x, payments: [...x.payments, p] } : x)));
    if (ok) postCash(saleCash(o, p));
    notify(ok ? `Đã thu ${vnd(p.amount)} cho ${o.code}, tự sinh phiếu thu quỹ` : `Đã ghi nhận ${vnd(p.amount)}, chờ Kế toán xác nhận`, 'teal');
  };
  const confirmSalePayment = (id: string, payId: string) => {
    const o = salesOrders.find((x) => x.id === id);
    const p = o?.payments.find((x) => x.id === payId);
    if (!o || !p || p.confirmed) return;
    if (!canAct('cash.manage') && !canAct('receipt.confirm')) return notify('Chỉ Kế toán xác nhận tiền thu', 'red');
    setSalesOrders((all) => all.map((x) => (x.id === id ? { ...x, payments: x.payments.map((y) => (y.id === payId ? { ...y, confirmed: true, confirmedBy: me?.id, confirmedAt: Date.now() } : y)) } : x)));
    postCash(saleCash(o, p));
    notify(`Đã xác nhận ${vnd(p.amount)} của ${o.code}, tự sinh phiếu thu quỹ`, 'teal');
  };
  const setSaleStatus = (id: string, status: SaleStatus, reason?: string) => {
    const o = salesOrders.find((x) => x.id === id);
    if (!o) return;
    if (status === 'CANCELLED' && o.status !== 'PENDING') return notify('Đơn đã xuất kho: lập phiếu nhập trả hàng ở Kho thay vì hủy', 'red');
    if (status === 'DONE' && o.status !== 'SHIPPING') return;
    setSalesOrders((all) => all.map((x) => (x.id === id ? { ...x, status, doneAt: status === 'DONE' ? Date.now() : x.doneAt, cancelReason: status === 'CANCELLED' ? reason : x.cancelReason, cancelledAt: status === 'CANCELLED' ? Date.now() : x.cancelledAt } : x)));
    if (me) writeAudit(status === 'CANCELLED' ? 'SALE_CANCEL' : 'SALE_DONE', `${status === 'CANCELLED' ? 'Hủy' : 'Hoàn thành'} đơn bán ${o.code}${reason ? `: ${reason}` : ''}`, status === 'CANCELLED' ? 'WARN' : 'INFO', realUserId ?? me.id);
    notify(status === 'CANCELLED' ? `Đã hủy ${o.code}, nhả hàng đang giữ` : `${o.code} đã giao xong`, status === 'CANCELLED' ? 'orange' : 'teal');
  };

  /** Hoàn tất đơn vừa lưu: thu tiền và xuất kho ngay (đơn truyền trực tiếp, không chờ cập nhật danh sách) */
  const completeSale: AppCtx['completeSale'] = (o, pay, issue) => {
    if (pay && pay.amount > 0) addSalePayment(o.id, pay.amount, pay.method, o);
    if (issue) issueSale(o.id, o);
  };

  const syncLeadToGetfly = (leadId: string) => {
    const l = leads.find((x) => x.id === leadId);
    const c = customers.find((x) => x.id === l?.customerId);
    if (!l || !c) return notify('Dự án chưa gắn khách hàng', 'red');
    void pushToGetfly(l, c);
  };

  // =================================================================
  //  PHÂN LEAD 2 BƯỚC
  // =================================================================

  /** Bước 1 — MKT phân lead về phòng ban (tự động nếu không truyền dept) */
  const routeLeads = (ids: string[], deptCode: DeptCode, base: Lead[] = leads) => {
    const work = base.map((l) => ({ ...l }));
    const routed: Lead[] = [];
    for (const id of ids) {
      const l = work.find((x) => x.id === id);
      if (!l) continue;
      l.score = l.score ?? scoreLead(l, customers);
      Object.assign(l, { dept: deptCode, routingReason: 'MKT phân phòng', status: 'ROUTED', assignee: undefined, routedAt: Date.now(), slaDeadline: undefined, slaMet: undefined, slaAlerted: false });
      routed.push(l);
    }
    if (!routed.length) return;
    setLeads(work);
    const sent = routed.flatMap((l) => dispatch('LEAD_ROUTED', { lead: l }));
    const d = dept(deptCode);
    notify(routed.length === 1
      ? `Đã phân ${routed[0].company} về ${d?.name}. Chờ ${userName(d?.headId)} chỉ định Sales${sent.length ? `. Đã gửi ${sent.join(', ')}` : ''}`
      : `Đã phân ${routed.length} lead về ${d?.name}`, 'teal');
  };

  /** Bước 2 — Trưởng phòng chỉ định Sales, bắt đầu SLA tiếp nhận */
  const assignLead = (leadId: string, repId: string) => {
    const l = leads.find((x) => x.id === leadId);
    const rep = users.find((u) => u.id === repId);
    if (!l || !rep) return;
    const d = dept(l.dept);
    const upd: Lead = { ...l, status: 'ASSIGNED', assignee: repId, slaDeadline: Date.now() + (d?.slaMinutes ?? 120) * 60_000, slaAlerted: false };
    setLeads((p) => p.map((x) => (x.id === leadId ? upd : x)));
    const sent = dispatch('LEAD_ASSIGNED', { lead: upd });
    notify(`Đã chỉ định ${rep.name}, SLA tiếp nhận ${d?.slaMinutes ?? 120} phút bắt đầu${sent.length ? `. Đã gửi ${sent.join(', ')}` : ''}`, 'teal');
  };

  /** Sales tiếp nhận -> chuyển sang Khảo sát & lên báo giá (SLA 24h) */
  const acceptLead = (id: string) => {
    const l = leads.find((x) => x.id === id);
    if (!l || !me) return;
    if (role === 'DEPT_HEAD' && me.dept !== l.dept) return notify('Lead không thuộc phòng ban của bạn', 'red');
    if (role === 'SALES_REP' && l.assignee !== me.id) return notify('Lead đang giao cho nhân sự khác', 'red');
    const met = !!l.slaDeadline && Date.now() <= l.slaDeadline;
    setLeads((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'ACCEPTED', slaMet: met, quoteDeadline: Date.now() + QUOTE_SLA_MS, quoteEscalated: false, boqStatus: x.boqStatus ?? 'NOT_STARTED' } : x)));
    notify(`${userName(l.assignee)} đã tiếp nhận ${l.company}${met ? ' đúng SLA' : ', trễ SLA'}. Hạn nộp BOQ và báo giá: 24 giờ.`, met ? 'teal' : 'orange');
  };

  const submitQuote = (id: string) => {
    const l = leads.find((x) => x.id === id);
    if (!l) return;
    const late = isQuoteOverdue(l, Date.now());
    setLeads((p) => p.map((x) => (x.id === id ? { ...x, status: 'QUOTED', boqStatus: 'DONE' } : x)));
    notify(`Đã gửi báo giá cho ${l.company}${late ? `, trễ ${Math.ceil((Date.now() - (l.quoteDeadline ?? 0)) / 3.6e6)} giờ` : ' đúng hạn'}`, late ? 'orange' : 'teal');
  };

  const markLost = (id: string, reason: LostReason, note: string) => {
    const l = leads.find((x) => x.id === id);
    if (!l) return;
    setLeads((p) => p.map((x) => (x.id === id ? { ...x, status: 'LOST', lostReason: reason, lostNote: note || undefined } : x)));
    setQuotes((p) => p.map((q) => (q.leadId === id && q.status === 'SENT' ? { ...q, status: 'REJECTED' } : q)));
    // Hàng giữ chỗ trong kho của dự án chuyển sang chờ Trưởng phòng / Giám đốc xác nhận giải phóng
    const held = reservations.filter((r) => r.kind === 'LEAD' && r.refId === id && r.status === 'HELD' && r.qty > 0);
    if (held.length) {
      const reqAt = todayISO();
      setReservations((p) => p.map((r) => (held.some((h) => h.id === r.id) ? { ...r, status: 'PENDING_RELEASE', releaseRequest: { at: reqAt, by: me?.id, reason: `Dự án Trượt: ${LOST_REASON[reason]}` } } : r)));
      dispatch('STOCK_RELEASE', { lead: l });
    }
    notify(`Đã ghi nhận Trượt ${l.company}: ${LOST_REASON[reason]}${held.length ? `. ${held.length} suất hàng giữ chỗ chờ Trưởng phòng / Giám đốc xác nhận giải phóng` : ''}`, 'orange');
  };

  // =================================================================
  //  KHO: NHẬP KHO CHỐT PHÂN BỔ, XUẤT GIAO, GIẢI PHÓNG GIỮ CHỖ
  // =================================================================
  const addMoves = (m: Omit<StockMove, 'id'>[]) => setMoves((p) => [...m.map((x) => ({ ...x, id: uid('mv') })), ...p].slice(0, 5000));
  const targetDept = (kind: PoAllocation['kind'], refId: string) => (kind === 'LEAD' ? leads.find((l) => l.id === refId)?.dept : customers.find((c) => c.id === refId)?.dept);
  const canRelease = (r: StockReservation) =>
    !!me && perms.actions['stock.release'].includes(role) && (role === 'BOD' || (role === 'DEPT_HEAD' && targetDept(r.kind, r.refId) === me.dept));

  const receiveShipment = (poId: string, shipmentId: string) => {
    const po = pos.find((p) => p.id === poId);
    const sh = po?.shipments.find((x) => x.id === shipmentId);
    if (!po || !sh || sh.status === 'RECEIVED') return;
    const d = todayISO();
    // Chốt phân bổ của đợt tại thời điểm nhập kho
    const snap: AllocSnapshot[] = sh.lines.map((l) => {
      const a = shipmentAllocation(po, sh.id, l.sku);
      return { sku: l.sku, reserved: a.reserved.map((r) => ({ ...r.a, qty: r.qty })), free: a.free };
    });
    const lost = new Set(leads.filter((l) => l.status === 'LOST').map((l) => l.id));
    const newRes: StockReservation[] = snap.flatMap((x) => x.reserved.filter((r) => r.qty > 0).map((r) => {
      const isLost = r.kind === 'LEAD' && lost.has(r.refId);
      return { id: uid('r'), sku: x.sku, kind: r.kind, refId: r.refId, qty: r.qty, delivered: 0, poId, shipmentId, receivedAt: d, status: isLost ? 'PENDING_RELEASE' : 'HELD', releaseRequest: isLost ? { at: d, by: me?.id, reason: 'Dự án đã Trượt trước khi hàng về' } : undefined } as StockReservation;
    }));
    setPos((all) => all.map((p) => (p.id !== poId ? p : { ...p, shipments: p.shipments.map((x) => (x.id === shipmentId ? { ...x, status: 'RECEIVED', receivedAt: d, allocSnapshot: snap } : x)) })));
    setSkus((all) => all.map((k) => { const f = snap.find((x) => x.sku === k.sku); return f?.free ? { ...k, stock: k.stock + f.free } : k; }));
    setReservations((p) => [...newRes, ...p]);
    const ref = `${po.code} ${sh.code}`;
    addMoves([
      ...snap.filter((x) => x.free > 0).map((x) => ({ at: d, sku: x.sku, type: 'RECEIVE_FREE' as StockMoveType, qty: x.free, poId, by: me?.id, note: ref })),
      ...newRes.map((r) => ({ at: d, sku: r.sku, type: 'RECEIVE_RESERVED' as StockMoveType, qty: r.qty, kind: r.kind, refId: r.refId, poId, by: me?.id, note: ref })),
    ]);
    const freeSum = snap.reduce((a, x) => a + x.free, 0);
    const resSum = newRes.reduce((a, r) => a + r.qty, 0);
    notify(`Đã nhập kho ${ref}: ${resSum.toLocaleString('vi-VN')} giữ chỗ, ${freeSum.toLocaleString('vi-VN')} vào tồn tự do`, 'teal');
    newRes.filter((r) => r.status === 'PENDING_RELEASE').forEach((r) => dispatch('STOCK_RELEASE', { lead: leads.find((l) => l.id === r.refId) }));
  };

  const deliverReservation = (id: string, qty: number, note: string) => {
    const r = reservations.find((x) => x.id === id);
    if (!r || qty <= 0 || qty > r.qty) return notify('Số lượng xuất giao không hợp lệ', 'red');
    if (r.status !== 'HELD') return notify('Suất giữ chỗ đang chờ xác nhận giải phóng, chưa xuất giao được', 'red');
    setReservations((p) => p.map((x) => (x.id === id ? { ...x, qty: x.qty - qty, delivered: x.delivered + qty, status: x.qty - qty === 0 ? 'DELIVERED' : x.status } : x)));
    addMoves([{ at: todayISO(), sku: r.sku, type: 'DELIVER', qty, kind: r.kind, refId: r.refId, poId: r.poId, by: me?.id, note }]);
    notify(`Đã xuất giao ${qty.toLocaleString('vi-VN')} ${r.sku}`, 'teal');
  };

  const requestRelease = (id: string, reason: string) => {
    const r = reservations.find((x) => x.id === id);
    if (!r || r.status !== 'HELD') return;
    setReservations((p) => p.map((x) => (x.id === id ? { ...x, status: 'PENDING_RELEASE', releaseRequest: { at: todayISO(), by: me?.id, reason } } : x)));
    dispatch('STOCK_RELEASE', { lead: r.kind === 'LEAD' ? leads.find((l) => l.id === r.refId) : undefined, body: `${r.sku} x ${r.qty}: ${reason}` });
    notify('Đã gửi yêu cầu, chờ Trưởng phòng / Giám đốc xác nhận', 'teal');
  };

  const decideRelease: AppCtx['decideRelease'] = (id, decision, note, target) => {
    const r = reservations.find((x) => x.id === id);
    if (!r || r.status !== 'PENDING_RELEASE') return;
    if (!canRelease(r)) return notify('Chỉ Trưởng phòng phụ trách hoặc Giám đốc được xác nhận', 'red');
    const d = todayISO();
    if (decision === 'KEEP') {
      setReservations((p) => p.map((x) => (x.id === id ? { ...x, status: 'HELD', releaseRequest: undefined } : x)));
      notify(`Giữ lại ${r.sku} cho đích hiện tại`, 'teal');
      return;
    }
    if (decision === 'TRANSFER') {
      if (!target?.refId) return notify('Chọn dự án / khách hàng nhận giữ chỗ', 'red');
      setReservations((p) => p.map((x) => (x.id === id ? { ...x, kind: target.kind, refId: target.refId, status: 'HELD', releaseRequest: undefined } : x)));
      addMoves([{ at: d, sku: r.sku, type: 'TRANSFER', qty: r.qty, kind: target.kind, refId: target.refId, poId: r.poId, by: me?.id, note: note || 'Chuyển giữ chỗ' }]);
      notify(`Đã chuyển ${r.qty.toLocaleString('vi-VN')} ${r.sku} sang đích mới`, 'teal');
    } else {
      setReservations((p) => p.map((x) => (x.id === id ? { ...x, status: 'RELEASED' } : x)));
      setSkus((all) => all.map((k) => (k.sku === r.sku ? { ...k, stock: k.stock + r.qty } : k)));
      addMoves([{ at: d, sku: r.sku, type: 'RELEASE', qty: r.qty, kind: r.kind, refId: r.refId, poId: r.poId, by: me?.id, note: note || r.releaseRequest?.reason || 'Giải phóng' }]);
      notify(`Đã trả ${r.qty.toLocaleString('vi-VN')} ${r.sku} về tồn tự do`, 'teal');
    }
    // Dự án đã Trượt: bỏ phần giữ chỗ chưa về trên các PO đang mở để đợt sau nhập vào tồn tự do
    if (r.kind === 'LEAD' && leads.find((l) => l.id === r.refId)?.status === 'LOST') {
      setPos((all) => all.map((po) => ({
        ...po,
        lines: po.lines.map((ln) => ({
          ...ln,
          allocations: ln.allocations
            .map((a) => (a.kind === 'LEAD' && a.refId === r.refId ? { ...a, qty: receivedReservedFor(po, ln.sku, a.kind, a.refId) } : a))
            .filter((a) => a.qty > 0),
        })),
      })));
    }
  };

  const reserveFromStock = (sku: string, kind: PoAllocation['kind'], refId: string, qty: number, note: string) => {
    const k = skus.find((x) => x.sku === sku);
    if (!k || qty <= 0 || qty > k.stock) return notify('Tồn tự do không đủ', 'red');
    if (!refId) return notify('Chọn dự án / khách hàng', 'red');
    const d = todayISO();
    setSkus((all) => all.map((x) => (x.sku === sku ? { ...x, stock: x.stock - qty } : x)));
    setReservations((p) => [{ id: uid('r'), sku, kind, refId, qty, delivered: 0, receivedAt: d, status: 'HELD' }, ...p]);
    addMoves([{ at: d, sku, type: 'RESERVE_FROM_STOCK', qty, kind, refId, by: me?.id, note }]);
    notify(`Đã giữ ${qty.toLocaleString('vi-VN')} ${sku} từ tồn tự do`, 'teal');
  };

  const reopenLead = (id: string) => {
    setLeads((p) => p.map((x) => (x.id === id ? { ...x, status: 'QUOTED', lostReason: undefined, lostNote: undefined } : x)));
    setReservations((p) => p.map((r) => (r.kind === 'LEAD' && r.refId === id && r.status === 'PENDING_RELEASE' && r.releaseRequest?.reason.startsWith('Dự án') ? { ...r, status: 'HELD', releaseRequest: undefined } : r)));
    notify('Đã mở lại dự án, hàng giữ chỗ chờ giải phóng được giữ lại', 'teal');
  };

  // ---- Tự phát hiện quá hạn SLA tiếp nhận / báo giá mỗi giây -> leo thang ----
  useEffect(() => {
    if (now == null || !sessionId) return;
    const breached = leads.filter((l) => isAcceptLate(l, now) && !l.slaAlerted);
    const overdue = leads.filter((l) => isQuoteOverdue(l, now) && !l.quoteEscalated);
    if (!breached.length && !overdue.length) return;
    setLeads((p) => p.map((l) => (breached.some((b) => b.id === l.id) ? { ...l, slaAlerted: true } : overdue.some((o) => o.id === l.id) ? { ...l, quoteEscalated: true } : l)));
    breached.forEach((l) => dispatch('SLA_BREACH', { lead: l }));
    overdue.forEach((l) => dispatch('QUOTE_OVERDUE', { lead: l }));
    if (overdue.length) notify(`QUÁ HẠN BÁO GIÁ: ${overdue.map((l) => l.company).join(', ')}. Đã leo thang tới Trưởng phòng.`, 'red');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // ---- Nhật ký bảo mật ----
  function writeAudit(action: string, detail: string, level: AuditLevel = 'INFO', userId?: string) {
    setAuditLogs((p) => [{ id: uid('au'), at: Date.now(), userId, action, detail, level }, ...p].slice(0, 1500));
  }

  // ---- Đăng nhập / vai trò ----
  const saveSession = (id: string, at: number, remember: boolean, platform = false, org = orgId) => {
    rememberRef.current = remember;
    try {
      const rec = JSON.stringify({ id, at, exp: at + security.sessionDays * 864e5, org, platform });
      if (remember) { localStorage.setItem(SESSION_KEY, rec); sessionStorage.removeItem(SESSION_KEY); }
      else { sessionStorage.setItem(SESSION_KEY, rec); localStorage.removeItem(SESSION_KEY); }
    } catch { /* bỏ qua */ }
  };
  /** Trả về thông báo lỗi, hoặc null nếu đăng nhập thành công */
  const login = async (email: string, password: string, remember: boolean): Promise<string | null> => {
    if (CLOUD_ON) return cloudLogin(email, password, remember);
    if (isPlatformEmail(email)) return platformLogin(email, password, remember);
    const target = (pathOrgId && ORGS.some((o) => o.id === pathOrgId) ? pathOrgId : null) ?? orgByEmail(email)?.id ?? orgId;
    const reg = platformTenants.find((r) => r.id === target);
    if (reg?.status === 'SUSPENDED') return `${orgOf(target).shortName} đang tạm dừng trên nền tảng 3A Group. Liên hệ 3A Group để kích hoạt lại.`;
    const pool = target === orgId ? users : chooseOrg(target);
    const at = Date.now();
    const u = pool.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    const generic = 'Email hoặc mật khẩu không đúng';
    if (!u) {
      writeAudit('LOGIN_FAIL', `Email không tồn tại: ${email.trim().slice(0, 60)}`, 'SECURITY');
      await new Promise((r) => setTimeout(r, 400));
      return generic;
    }
    if (u.lockedUntil && u.lockedUntil > at) return `Tài khoản tạm khóa do nhập sai nhiều lần, thử lại sau ${new Date(u.lockedUntil).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    if (!u.active) return 'Tài khoản đã bị khóa. Liên hệ quản trị hệ thống.';
    let ok = false;
    try { ok = await verifyPassword(u, password); } catch (e) { return e instanceof Error ? e.message : 'Lỗi xác thực'; }
    if (!ok) {
      const n = (u.failedAttempts ?? 0) + 1;
      const lock = n >= security.lockoutAttempts;
      setUsers((p) => p.map((x) => (x.id === u.id ? { ...x, failedAttempts: lock ? 0 : n, lockedUntil: lock ? at + security.lockoutMinutes * 60_000 : x.lockedUntil } : x)));
      writeAudit(lock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAIL', lock ? `${u.email} bị khóa ${security.lockoutMinutes} phút sau ${n} lần sai` : `${u.email} nhập sai mật khẩu lần ${n}`, 'SECURITY', u.id);
      return lock ? `Sai mật khẩu ${n} lần. Tài khoản bị khóa ${security.lockoutMinutes} phút.` : `${generic} (còn ${security.lockoutAttempts - n} lần thử)`;
    }
    let patch: Partial<User> = { failedAttempts: 0, lockedUntil: undefined, lastLoginAt: at };
    if (!u.passwordHash) {
      const h = await hashPassword(password);
      patch = { ...patch, passwordHash: h.hash, salt: h.salt };
    }
    const mustChangeNow = !!u.mustChangePassword || (security.forceChangeDefault && password === DEMO_PASSWORD);
    setUsers((p) => p.map((x) => (x.id === u.id ? { ...x, ...patch, mustChangePassword: mustChangeNow } : x)));
    lastActive.current = at;
    setSessionId(u.id);
    setRealUserId(u.id);
    setLoginAt(at);
    setPage('home');
    setIdleOut(false);
    saveSession(u.id, at, remember);
    setPathOrg(target);
    writeAudit('LOGIN', `${u.email} đăng nhập`, 'INFO', u.id);
    if (mustChangeNow) setMustChange(true);
    else notify(`Xin chào ${u.name}`, 'teal');
    return null;
  };
  /** Đăng nhập quản trị nền tảng 3A: xác thực trên danh sách quản trị riêng, vào doanh nghiệp đang chọn với quyền BOD */
  const platformLogin = async (email: string, password: string, remember: boolean): Promise<string | null> => {
    const at = Date.now();
    const generic = 'Email hoặc mật khẩu không đúng';
    const u = platformAdmins.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u) { await new Promise((r) => setTimeout(r, 400)); return generic; }
    if (u.lockedUntil && u.lockedUntil > at) return `Tài khoản tạm khóa, thử lại sau ${new Date(u.lockedUntil).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    if (!u.active) return 'Tài khoản quản trị nền tảng đã bị khóa.';
    let ok = false;
    try { ok = await verifyPassword(u, password); } catch (e) { return e instanceof Error ? e.message : 'Lỗi xác thực'; }
    if (!ok) {
      const n = (u.failedAttempts ?? 0) + 1;
      const lock = n >= security.lockoutAttempts;
      setPlatformAdmins((p) => p.map((x) => (x.id === u.id ? { ...x, failedAttempts: lock ? 0 : n, lockedUntil: lock ? at + security.lockoutMinutes * 60_000 : x.lockedUntil } : x)));
      writeAudit('PLATFORM_LOGIN_FAIL', `${u.email} nhập sai mật khẩu lần ${n}`, 'SECURITY');
      return lock ? `Sai mật khẩu ${n} lần. Tài khoản bị khóa ${security.lockoutMinutes} phút.` : `${generic} (còn ${security.lockoutAttempts - n} lần thử)`;
    }
    let patch: Partial<User> = { failedAttempts: 0, lockedUntil: undefined, lastLoginAt: at };
    if (!u.passwordHash) { const h = await hashPassword(password); patch = { ...patch, passwordHash: h.hash, salt: h.salt }; }
    const mustChangeNow = !!u.mustChangePassword || (security.forceChangeDefault && password === DEMO_PASSWORD);
    setPlatformAdmins((p) => p.map((x) => (x.id === u.id ? { ...x, ...patch, mustChangePassword: mustChangeNow } : x)));
    lastActive.current = at;
    setPlatformId(u.id); setSessionId(u.id); setRealUserId(u.id); setLoginAt(at); setPage('overview'); setIdleOut(false); setConsoleView(true); setConsoleTab('overview');
    saveSession(u.id, at, remember, true);
    writeAudit('PLATFORM_LOGIN', `${u.email} (3A Platform) vào ${orgOf(orgId).shortName}`, 'SECURITY', u.id);
    if (mustChangeNow) setMustChange(true);
    else notify(`3A Group Platform: đang xem ${orgOf(orgId).shortName}`, 'teal');
    return null;
  };
  // =================================================================
  //  ĐĂNG NHẬP & ĐỒNG BỘ ĐÁM MÂY
  // =================================================================
  const platformAdminsRef = useRef(platformAdmins);
  platformAdminsRef.current = platformAdmins;
  /** Áp thay đổi từ máy khác vào state (bản ghi đang sửa dở trên máy được giữ nguyên) */
  const applyRemote = (ts: TenantSync, b: RemoteBatch) => {
    if (syncRef.current !== ts) return;
    for (const [coll, changes] of Object.entries(b.keyed)) {
      const entry = persisted[coll];
      if (!entry) continue;
      (entry[1] as (f: (p: AnyRec[]) => AnyRec[]) => void)((prev) => ts.mergeList(Array.isArray(prev) ? prev : [], coll, changes));
    }
    for (const [k, { value, prevBase }] of Object.entries(b.whole)) {
      const entry = persisted[k];
      if (!entry) continue;
      const def = entry[2];
      (entry[1] as (f: (p: unknown) => unknown) => void)((prev) => {
        if (prevBase !== undefined && canon(secretless(k, prev)).json !== prevBase) return prev;
        if (def && typeof def === 'object' && !Array.isArray(def)) {
          const keep = secretKeep(k, prev);
          return { ...withDefaults(value, def as AnyRec), ...keep };
        }
        return value;
      });
    }
  };
  const applyPlatformRemote = (ps: TenantSync, b: RemoteBatch) => {
    if (platSyncRef.current !== ps) return;
    const t = b.keyed.tenants;
    if (t) {
      registerOrgs(t.filter((c) => !c.deleted && c.value).map((c) => c.value as TenantReg));
      setPlatformTenants((prev) => ps.mergeList(prev as AnyRec[], 'tenants', t) as TenantReg[]);
      const mine = t.find((c) => c.id === orgRef.current && !c.deleted);
      if (mine?.value) setCompany((c) => ({ ...c, enabledModules: (mine.value as TenantReg).modules }));
    }
    if (b.keyed.logs) setPlatformLogs((prev) => ps.mergeList(prev as AnyRec[], 'logs', b.keyed.logs) as PlatformLog[]);
  };
  const attachSync = (ts: TenantSync, ps?: TenantSync) => {
    syncRef.current = ts;
    ts.onInfo = (i) => setSyncInfo({ ...i });
    ts.onRemote = (b) => applyRemote(ts, b);
    ts.startPolling();
    setSyncInfo({ ...ts.info });
    if (ps) {
      platSyncRef.current = ps;
      ps.onRemote = (b) => applyPlatformRemote(ps, b);
      ps.startPolling();
    }
  };
  /** Sau khi có phiên Supabase: xác định doanh nghiệp được vào, tải dữ liệu, mở phiên làm việc */
  const cloudEnter = async (remember: boolean, password?: string, preferOrg?: string, toConsole = true): Promise<string | null> => {
    const sess = cloud.session;
    if (!sess) return 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại';
    cloud.remember = remember;
    const email = sess.user.email.toLowerCase();
    try {
      const access = await cloud.access();
      const isPlat = access.some((a) => a.platform);
      const tenants0 = access.filter((a) => !a.platform).map((a) => a.tenant_id);
      const ps = new TenantSync(PLATFORM_TENANT);
      const pl = await ps.load();
      ps.readOnly = !isPlat;
      const stored = Array.isArray(pl.data.tenants) ? (pl.data.tenants as TenantReg[]) : [];
      const regs = regsFromStored(stored);
      const tenants = tenants0.filter((t) => ORGS.some((o) => o.id === t));
      const last = storage.get(LAST_ORG_KEY);
      const pick = (list: string[]) => [preferOrg, last].find((x): x is string => !!x && list.includes(x)) ?? list[0];
      const org = isPlat ? pick(ORGS.map((o) => o.id)) : pick(tenants);
      if (!org) { await cloud.signOut(); return 'Tài khoản chưa được cấp quyền vào doanh nghiệp nào. Liên hệ Giám đốc doanh nghiệp hoặc 3A Group.'; }
      if (!isPlat && regs.find((r) => r.id === org)?.status === 'SUSPENDED') { await cloud.signOut(); return `${orgOf(org).shortName} đang tạm dừng trên nền tảng 3A Group. Liên hệ 3A Group để kích hoạt lại.`; }
      const ts = new TenantSync(org);
      const td = await ts.load();
      syncRef.current?.stop(); platSyncRef.current?.stop();
      setPlatformTenants(regs);
      setPlatformLogs(Array.isArray(pl.data.logs) ? (pl.data.logs as PlatformLog[]) : []);
      const users = loadOrg(org, regs, td);
      if (td.version > DATA_VERSION) ts.readOnly = true;
      tenantCloudStats[org] = { ...statsOf(td.data), version: td.version || DATA_VERSION };
      const at = Date.now();
      lastActive.current = at;
      if (isPlat) {
        const known = platformAdminsRef.current.find((a) => a.email.toLowerCase() === email) ?? INITIAL_PLATFORM_ADMINS.find((a) => a.email === email);
        const admin: User = known ?? { id: `pa-${email}`, name: email.split('@')[0], email, role: 'BOD', active: true, approvalLimit: 1e13 };
        setPlatformAdmins((p) => (p.some((a) => a.id === admin.id) ? p : [...p, admin]));
        attachSync(ts, ps);
        setPlatformId(admin.id); setSessionId(admin.id); setRealUserId(admin.id); setLoginAt(at); setIdleOut(false); setConsoleView(toConsole); if (toConsole) setConsoleTab('overview'); else setPage('home');
        storage.set(LAST_ORG_KEY, org);
        setOrgChoices(null); setPathOrg(toConsole ? null : org);
        writeAudit('PLATFORM_LOGIN', `${email} (3A Platform) vào ${orgOf(org).shortName}`, 'SECURITY', admin.id);
        if (password === DEMO_PASSWORD) setMustChange(true);
        return null;
      }
      const u = users.find((x) => x.email.toLowerCase() === email);
      if (!u || !u.active) {
        ts.stop(); ps.stop();
        await cloud.signOut();
        return !u ? `Email ${email} chưa có trong danh sách nhân sự của ${orgOf(org).shortName}. Liên hệ Giám đốc để được thêm.` : 'Tài khoản đã bị khóa. Liên hệ quản trị hệ thống.';
      }
      attachSync(ts, ps);
      setUsers((p) => p.map((x) => (x.id === u.id ? { ...x, lastLoginAt: at, failedAttempts: 0, lockedUntil: undefined } : x)));
      setPlatformId(null); setConsoleView(false);
      setSessionId(u.id); setRealUserId(u.id); setLoginAt(at); setPage('home'); setIdleOut(false);
      storage.set(LAST_ORG_KEY, org);
      setOrgChoices(null); setPathOrg(org);
      writeAudit('LOGIN', `${u.email} đăng nhập`, 'INFO', u.id);
      if (u.mustChangePassword || password === DEMO_PASSWORD) setMustChange(true);
      else notify(`Xin chào ${u.name}`, 'teal');
      return null;
    } catch (e) {
      return cloudMessage(e);
    }
  };
  const cloudLogin = async (email: string, password: string, remember: boolean): Promise<string | null> => {
    try { await cloud.signIn(email, password, remember); }
    catch (e) {
      writeAudit('LOGIN_FAIL', `Đăng nhập thất bại: ${email.trim().slice(0, 60)}`, 'SECURITY');
      return cloudMessage(e);
    }
    return cloudGate(remember, password);
  };
  /**
   * v39: sau khi xác thực, quyết định vào thẳng hay cho chọn doanh nghiệp:
   * - đường dẫn /<mã> và tài khoản có quyền -> vào doanh nghiệp đó;
   * - chỉ thuộc 1 doanh nghiệp -> vào thẳng; khôi phục phiên -> vào doanh nghiệp dùng lần trước;
   * - thuộc nhiều doanh nghiệp / quản trị 3A -> màn "Chọn doanh nghiệp" (chỉ các doanh nghiệp được cấp quyền).
   */
  const cloudGate = async (remember: boolean, password?: string, restore = false): Promise<string | null> => {
    const sess = cloud.session;
    if (!sess) return 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại';
    try {
      const access = await cloud.access();
      const isPlat = access.some((a) => a.platform);
      const pl = await new TenantSync(PLATFORM_TENANT).load();
      registerOrgs(Array.isArray(pl.data.tenants) ? (pl.data.tenants as TenantReg[]) : []);
      const ids = (isPlat ? ORGS.map((o) => o.id) : access.filter((a) => !a.platform).map((a) => a.tenant_id)).filter((t) => ORGS.some((o) => o.id === t));
      const want = pathOrgId;
      const last = storage.get(LAST_ORG_KEY);
      if (want && ids.includes(want)) return cloudEnter(remember, password, want, false);
      if (!isPlat && !ids.length) { await cloud.signOut(); return 'Tài khoản chưa được cấp quyền vào doanh nghiệp nào. Liên hệ Giám đốc doanh nghiệp hoặc 3A Group.'; }
      if (!want && !isPlat && ids.length === 1) return cloudEnter(remember, password, ids[0], false);
      if (!want && restore && last && ids.includes(last)) return cloudEnter(remember, password, last, isPlat);
      pendingLogin.current = { remember, password };
      const email = sess.user.email.toLowerCase();
      setOrgChoices({ ids, platform: isPlat, email, note: want ? `Tài khoản ${email} không có quyền vào ${remoteBrand?.shortName ?? want.toUpperCase()}. Chọn doanh nghiệp bạn được cấp quyền:` : undefined });
      return null;
    } catch (e) { return cloudMessage(e); }
  };
  const pickOrg = async (id: string): Promise<string | null> => {
    const pend = pendingLogin.current;
    const err = id === '_console' ? await cloudEnter(pend.remember, pend.password, storage.get(LAST_ORG_KEY) ?? undefined, true) : await cloudEnter(pend.remember, pend.password, id, false);
    if (!err) pendingLogin.current = { remember: false };
    else if (!cloud.session) setOrgChoices(null);
    return err;
  };
  const cancelPick = () => { pendingLogin.current = { remember: false }; setOrgChoices(null); void cloud.signOut(); };
  // Nhận diện doanh nghiệp theo đường dẫn khi chưa đăng nhập: có sẵn trong danh mục thì dùng, chưa có thì hỏi máy chủ (chỉ tên, màu, logo)
  useEffect(() => {
    if (!pathOrgId || ORGS.some((o) => o.id === pathOrgId) || !CLOUD_ON) { setRemoteBrand(null); return; }
    let live = true;
    void cloud.brand(pathOrgId).then((b) => { if (live) setRemoteBrand(b); });
    return () => { live = false; };
  }, [pathOrgId]);
  // Kiểm tra quyền định kỳ (30 giây): bị khóa / thu hồi quyền / hết phiên thì đăng xuất ngay
  useEffect(() => {
    if (!CLOUD_ON || !sessionId) return;
    const t = setInterval(async () => {
      if (!cloud.session) { logout(); setToast({ msg: 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại', tone: 'orange' }); return; }
      try {
        const acc = await cloud.access();
        if (!acc.some((a) => a.platform || a.tenant_id === orgRef.current)) {
          logout();
          setToast({ msg: 'Tài khoản đã bị khóa hoặc thu hồi quyền truy cập. Liên hệ Giám đốc.', tone: 'red' });
        }
      } catch (e) { if (e instanceof CloudError && e.status === 401) { logout(); setToast({ msg: 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại', tone: 'orange' }); } }
    }, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);
  // Cảnh báo khi đóng tab lúc còn thay đổi chưa gửi lên máy chủ
  useEffect(() => {
    if (!CLOUD_ON) return;
    const h = (e: BeforeUnloadEvent) => {
      const ts = syncRef.current;
      if (ts && (ts.info.state === 'syncing' || ts.pendingCount() > 0)) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);
  const postCash = (e: CashDraft) => {
    setCashEntries((all) => {
      if (e.source && e.sourceId && all.some((x) => x.source === e.source && x.sourceId === e.sourceId)) return all;
      const date = e.date ?? todayISO();
      const prefix = e.kind === 'IN' ? 'PTQ' : e.kind === 'OUT' ? 'PCQ' : 'CQ';
      const code = nextCode(all.filter((x) => x.code.startsWith(`${prefix}-`)).map((x) => x.code), `${prefix}-${date.slice(0, 4)}-`, 4);
      return [{ ...e, id: uid('ce'), code, date, by: e.by ?? sessionId ?? undefined, at: Date.now() }, ...all];
    });
  };
  /** Chuyển nhanh doanh nghiệp (chỉ tài khoản nền tảng): lưu dữ liệu đang mở, nạp dữ liệu doanh nghiệp kia */
  // ---- 3A Platform Console: nhật ký, cấp phép module, sao lưu & nâng cấp dữ liệu từng doanh nghiệp ----
  const platformLog = (action: string, detail: string, tenant?: string) => setPlatformLogs((p) => [{ id: uid('pl'), at: Date.now(), by: platformUser?.email ?? 'system', tenant, action, detail }, ...p].slice(0, 300));
  /** v39: tạo doanh nghiệp mới: hồ sơ nhận diện + gói + tài khoản quản trị đầu tiên (máy chủ: tạo tài khoản đăng nhập và cấp quyền quản trị) */
  const addTenant = async (o: Org, plan: TenantPlan, password: string): Promise<string | null> => {
    if (!platformId) return 'Chỉ quản trị 3A Group được tạo doanh nghiệp';
    const issue = orgIdIssue(o.id);
    if (issue) return issue;
    const org: Org = { ...o, custom: true };
    if (CLOUD_ON) {
      try { await cloud.provision(o.adminEmail ?? '', o.id, password, true, { role: 'BOD', appUserId: 'admin' }); }
      catch (e) { return cloudMessage(e); }
    }
    const reg: TenantReg = { ...defaultTenantReg(org), plan, seats: TENANT_PLAN[plan].seats, contractStart: todayISO(), contractEnd: isoDay(Date.now() + 365 * 864e5), org };
    registerOrgs([reg]);
    setPlatformTenants((all) => [...all.filter((r) => r.id !== org.id), reg]);
    platformLog('TENANT_CREATE', `Tạo doanh nghiệp ${org.shortName} (/${org.id}), quản trị ${o.adminEmail ?? ''}`, org.id);
    return null;
  };
  const setTenantReg = (id: string, patch: Partial<TenantReg>, logDetail?: string) => {
    setPlatformTenants((all) => all.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    if (patch.modules && id === loadedOrg) setCompany((c) => ({ ...c, enabledModules: { ...(c.enabledModules ?? {}), ...patch.modules } }));
    if (logDetail) platformLog('TENANT_UPDATE', logDetail, id);
  };
  /** Ghi dữ liệu doanh nghiệp đang mở xuống khóa lưu của nó (trước khi thao tác dữ liệu ở cấp nền tảng) */
  const flushCurrent = () => {
    if (CLOUD_ON || dataLocked || loadedOrg !== orgId) return;
    storage.set(dataKey(orgId), JSON.stringify({ v: DATA_VERSION, savedAt: Date.now(), data: collectData() } satisfies StoredData));
  };
  /**
   * Nâng cấp cấu trúc dữ liệu một doanh nghiệp: chụp snapshot -> chạy các bước MIGRATIONS từ bản đang lưu
   * -> bổ sung nhóm dữ liệu / trường mới bằng giá trị mặc định (không xóa trường cũ) -> ghi lại đúng khóa của doanh nghiệp đó.
   */
  const runTenantMigration = (org: string) => {
    if (CLOUD_ON) { notify('Chế độ máy chủ: dữ liệu tự nâng cấp khi mở doanh nghiệp bằng bản app mới.', 'orange'); return; }
    if (org === loadedOrg) flushCurrent();
    const raw = storage.get(dataKey(org)) ?? storage.get(v18DataKey(org)) ?? storage.get(oldDataKey(org));
    if (!raw) { notify(`${orgOf(org).shortName} chưa có dữ liệu trên máy này`, 'orange'); return; }
    let st: StoredData;
    try { st = JSON.parse(raw) as StoredData; } catch { notify('Dữ liệu hỏng, không nâng cấp được. Khôi phục từ snapshot.', 'red'); return; }
    const from = st.v ?? 0;
    if (from > DATA_VERSION) { notify(`Dữ liệu ${orgOf(org).shortName} ở phiên bản ${from}, mới hơn app (${DATA_VERSION}). Cập nhật app trước.`, 'red'); return; }
    if (!storage.get(dataKey(org))) storage.set(dataKey(org), raw);
    takeSnapshot(org, `truoc-nang-cap-v${from}`);
    const { data: migrated, steps } = migrateData((st.data ?? {}) as AnyRec, from);
    const defaults: AnyRec = { ...Object.fromEntries(Object.entries(persisted).map(([k, x]) => [k, x[2]])), docTemplates: initialDocTemplates(), ...orgDefaults(org, Object.fromEntries(Object.entries(persisted).map(([k, x]) => [k, x[2]]))) };
    const added: string[] = [];
    const data: AnyRec = { ...migrated };
    for (const k of Object.keys(persisted)) {
      const def = defaults[k];
      if (!(k in data)) { data[k] = def; added.push(k); }
      else if (def && typeof def === 'object' && !Array.isArray(def)) data[k] = withDefaults(data[k], def as AnyRec);
    }
    storage.set(dataKey(org), JSON.stringify({ v: DATA_VERSION, savedAt: Date.now(), data } satisfies StoredData));
    setPlatformTenants((all) => all.map((r) => (r.id === org ? { ...r, lastMigrationAt: Date.now() } : r)));
    platformLog('TENANT_MIGRATION', `v${from} -> v${DATA_VERSION}${steps.length ? `, chạy bước ${steps.join(', ')}` : ''}${added.length ? `, bổ sung ${added.join(', ')}` : ''}`, org);
    if (org === loadedOrg) loadOrg(org);
    notify(`Đã nâng cấp dữ liệu ${orgOf(org).shortName} lên v${DATA_VERSION}${added.length ? `, bổ sung ${added.length} nhóm dữ liệu mới` : ''}. Snapshot trước nâng cấp đã lưu.`, 'teal');
  };
  const backupTenant = async (org: string, pass: string) => {
    if (CLOUD_ON && org !== loadedOrg) { notify(`Truy cập ${orgOf(org).shortName} trước rồi sao lưu (dữ liệu tải từ máy chủ)`, 'orange'); return; }
    if (org === loadedOrg) flushCurrent();
    const raw = CLOUD_ON ? JSON.stringify({ v: DATA_VERSION, savedAt: Date.now(), data: collectData() } satisfies StoredData) : storage.get(dataKey(org));
    if (!raw) { notify(`${orgOf(org).shortName} chưa có dữ liệu`, 'orange'); return; }
    const st = JSON.parse(raw) as StoredData;
    const enc = await encryptBackup({ v: st.v, org, data: st.data }, pass, st.v);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(enc)], { type: 'application/json' }));
    a.download = `3a-${org}-saoluu-v${st.v}-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setPlatformTenants((all) => all.map((r) => (r.id === org ? { ...r, lastBackupAt: Date.now() } : r)));
    platformLog('TENANT_BACKUP', `Sao lưu mã hóa AES-GCM v${st.v}, ${(raw.length * 2 / 1024).toFixed(0)} KB`, org);
    notify(`Đã tải bản sao lưu mã hóa của ${orgOf(org).shortName}`, 'teal');
  };
  const restoreTenantSnapshot = (org: string, key: string) => {
    const snap = storage.get(key);
    if (!snap) { notify('Không còn bản chụp này', 'red'); return; }
    if (org === loadedOrg) flushCurrent();
    takeSnapshot(org, 'truoc-khoi-phuc');
    storage.set(dataKey(org), snap);
    platformLog('TENANT_RESTORE', `Khôi phục snapshot ${new Date(Number(key.slice(snapPrefix(org).length).split(':')[0])).toLocaleString('vi-VN')}`, org);
    if (org === loadedOrg) loadOrg(org);
    notify(`Đã khôi phục dữ liệu ${orgOf(org).shortName} từ snapshot`, 'teal');
  };
  const switchTenant = (org: string) => {
    if (!platformId || !ORGS.some((o) => o.id === org)) return;
    setConsoleView(false);
    if (org === orgId) return;
    stickyReset();
    if (CLOUD_ON) {
      setCloudBusy(true);
      void (async () => {
        try {
          await syncRef.current?.flush();
          const ts = new TenantSync(org);
          const td = await ts.load();
          syncRef.current?.stop();
          loadOrg(org, platformTenants, td);
          if (td.version > DATA_VERSION) ts.readOnly = true;
          attachSync(ts);
          storage.set(LAST_ORG_KEY, org);
          setPathOrg(org);
          writeAudit('PLATFORM_SWITCH', `${platformUser?.email ?? ''} chuyển sang ${orgOf(org).shortName}`, 'WARN', platformId);
          notify(`Đã chuyển sang ${orgOf(org).name}`, 'teal');
        } catch (e) { notify(cloudMessage(e), 'red'); }
        finally { setCloudBusy(false); }
      })();
      return;
    }
    const json = JSON.stringify({ v: DATA_VERSION, savedAt: Date.now(), data: collectData() } satisfies StoredData);
    if (!dataLocked && loadedOrg === orgId) storage.set(dataKey(orgId), json);
    loadOrg(org);
    storage.set(LAST_ORG_KEY, org);
    setPathOrg(org);
    setSessionId(platformId);
    saveSession(platformId, loginAt ?? Date.now(), rememberRef.current, true, org);
    setTimeout(() => writeAudit('PLATFORM_SWITCH', `${platformUser?.email ?? ''} chuyển sang ${orgOf(org).shortName}`, 'WARN', platformId), 0);
    notify(`Đã chuyển sang ${orgOf(org).name}`, 'teal');
  };
  const logout = () => {
    stickyReset();
    if (sessionId) writeAudit('LOGOUT', 'Đăng xuất', 'INFO', realUserId ?? sessionId);
    if (CLOUD_ON) {
      const ts = syncRef.current; const ps = platSyncRef.current;
      syncRef.current = null; platSyncRef.current = null; setSyncInfo(null);
      void (async () => { await ts?.flush(); await ps?.flush(); ts?.stop(); ps?.stop(); await cloud.signOut(); })();
      // xóa dữ liệu doanh nghiệp khỏi bộ nhớ trang để người dùng sau trên cùng máy không thấy
      setTimeout(() => loadOrg(orgId, platformTenants, { data: {}, version: DATA_VERSION }), 0);
    }
    setPlatformId(null);
    setConsoleView(false);
    setSessionId(null);
    setRealUserId(null);
    setMustChange(false);
    setOpenClaimId(null);
    setOpenCustomerId(null);
    try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch { /* bỏ qua */ }
  };
  const realUser = allUsers.find((u) => u.id === (realUserId ?? sessionId));
  /** Chuyển vai trò để xem thử: chỉ tài khoản BOD đăng nhập thật, có thể tắt trong Cài đặt bảo mật */
  const switchRole = (r: Role) => {
    if (!security.roleSwitch || realUser?.role !== 'BOD') return notify('Chuyển vai trò chỉ dành cho Ban Giám đốc và đang bị tắt trong cài đặt bảo mật', 'red');
    const u = users.find((x) => x.id === ROLE_PERSONA[r] && x.active) ?? users.find((x) => x.role === r && x.active);
    if (!u) return notify(`Không có tài khoản hoạt động cho vai trò ${ROLE_LABEL[r]}`, 'red');
    setSessionId(u.id);
    writeAudit('ROLE_SWITCH', `${realUser.name} xem với vai trò ${ROLE_LABEL[r]} (${u.name})`, 'WARN', realUser.id);
    notify(r === 'BOD' && u.id === realUser.id ? 'Đã trở lại tài khoản của bạn' : `Đang xem với vai trò ${ROLE_LABEL[r]} (${u.name})`, 'teal');
  };

  // ---- URL theo màn hình: #/<doanh nghiệp>/<phân hệ> hoặc #/console/<mục>. Tải lại / gửi link / nút Back giữ đúng màn hình ----
  const routeConsole = !!platformId && consoleView;
  const routeHash = routeConsole ? `#/console/${consoleTab}` : `#/${orgId}/${page}`;
  const routeReady = useRef(false);
  const applyRoute = (hash: string) => {
    const m = /^#\/([\w-]+)\/([\w-]+)(?:\/([\w-]+))?/.exec(hash);
    if (!m) return;
    const [, a, b, sub] = m;
    if (b === 'settings' && sub) stickyStore.set('SettingsModule.tab', sub);
    if (a === 'console') {
      if (platformId && CONSOLE_TABS.some((t) => t.id === b)) { setConsoleView(true); setConsoleTab(b as ConsoleTab); }
      return;
    }
    if (a !== orgId) { if (platformId && ORGS.some((o) => o.id === a)) switchTenant(a); return; }
    if (routeConsole) setConsoleView(false);
    if ((MODULES as string[]).includes(b) && seeModule(b as Module) && moduleEnabled(company, b as Module)) { setPresetQuery(''); setPage(b as Module); }
  };
  useEffect(() => {
    if (!me) { routeReady.current = false; return; }
    if (!ready || cloudBoot) return;
    if (!routeReady.current) {
      routeReady.current = true;
      if (location.hash && location.hash !== routeHash) { applyRoute(location.hash); if (!location.hash.startsWith(`${routeHash}/`)) return; }
    }
    if (location.hash !== routeHash && !location.hash.startsWith(`${routeHash}/`)) history.pushState(null, '', routeHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeHash, me?.id, ready, cloudBoot]);
  useEffect(() => {
    const onHash = () => { if (me && ready && !cloudBoot && location.hash !== routeHash && !location.hash.startsWith(`${routeHash}/`)) applyRoute(location.hash); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  });

  if (!ready || cloudBoot) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[rgb(var(--bg))] text-sm text-[rgb(var(--muted))]" role="status">
        {cloudBoot && <><RefreshCw className="h-6 w-6 text-[rgb(var(--accent))] motion-safe:animate-spin" aria-hidden />Đang kết nối máy chủ và tải dữ liệu…</>}
      </div>
    );
  }

  const fontStyle = (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
      ${THEME_CSS}
      /* Màu nhấn cam (trạng thái đang chọn, số đếm, KPI nổi bật) */
      .g-brand { background-color: rgb(var(--accent)); }
      .g-brand-text { color: rgb(var(--accent-fg)); }
      .font-display, h1, h2 { font-family: 'Be Vietnam Pro', system-ui, sans-serif; letter-spacing: -0.01em; font-weight: 500; }
      .font-mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0; }
      .font-num, table.dt td.tabular-nums, table.dt td.text-right:not(:last-child), table.dt td .tabular-nums { font-variant-numeric: tabular-nums; }
      table.dt tbody tr { transition: background-color .15s var(--ease); }
      table.dt tbody tr:hover { background-color: rgb(var(--ink) / 0.03); }
      table.dt thead th { font-size: 12.5px; font-weight: 400; text-transform: none; letter-spacing: 0; color: rgb(var(--muted)); white-space: nowrap; }
      table.dt thead th button { text-transform: none !important; letter-spacing: 0 !important; }
      @media (min-width: 768px) {
        /* v40: mỗi ô một dòng, chữ dài rút gọn bằng dấu … */
        table.dt > tbody > tr > td { white-space: nowrap; }
        table.dt > tbody > tr > td .truncate { max-width: 190px; }
        table.dt > tbody > tr > td[class*="--fg2"] .truncate, table.dt > tbody > tr > td[class*="--muted"] .truncate { max-width: 150px; }
        table.dt > tbody > tr > td, table.dt > thead > tr > th { padding-left: 10px; padding-right: 10px; }
        table.dt > tbody > tr > td:first-child, table.dt > thead > tr > th:first-child { padding-left: 16px; }
        table.dt > tbody > tr > td:last-child, table.dt > thead > tr > th:last-child { padding-right: 16px; }
        table.dt > tbody > tr > td[colspan] { white-space: normal; }
      }
      .code-chip { display: inline-block; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11.5px; line-height: 18px; padding: 0 6px; border-radius: 4px; background: rgb(var(--ink) / 0.06); color: rgb(var(--fg2)); white-space: nowrap; }
      .skip-link { position: absolute; left: 12px; top: -48px; z-index: 100; padding: 8px 12px; border-radius: 8px; background: rgb(var(--surface)); color: rgb(var(--fg)); box-shadow: var(--shadow); }
      .skip-link:focus { top: 12px; }
      table.dt-stt > tbody > tr { counter-increment: stt; }
      table.dt-stt > tbody > tr:has(> td[colspan]), table.dt-stt > tbody > tr[data-sub] { counter-increment: none; }
      table.dt-stt > tbody > tr[data-sub]::before { content: ''; }
      table.dt-stt > tbody > tr::before { content: counter(stt); display: table-cell; vertical-align: middle; width: 3.5rem; padding: .75rem .75rem .75rem 1.25rem; font-variant-numeric: tabular-nums; font-size: 13px; color: rgb(var(--muted)); }
      table.dt-stt > tbody > tr:has(> td[colspan])::before { content: ''; }
      table.dt-stt > tbody > tr > td:first-child { padding-left: .75rem; }
      @media (min-width: 768px) {
        table.dt-act > tbody > tr > td:last-child:not([colspan]) { text-align: right; white-space: nowrap; }
        table.dt-act > tbody > tr > td:last-child:not([colspan]) > .flex, table.dt-act > tbody > tr > td:last-child:not([colspan]) > div { justify-content: flex-end; }
      }
      @media (max-width: 767px) {
        table.dt-cards { min-width: 0 !important; display: block; }
        table.dt-cards thead { display: none; }
        table.dt-cards tbody { display: block; }
        table.dt-cards tbody tr { display: block; margin-bottom: 10px; padding: 10px 12px; border: 1px solid rgb(var(--line)); border-radius: 10px; background-color: rgb(var(--surface)); }
        table.dt-cards tbody tr:nth-child(even) { background-color: rgb(var(--surface)); }
        table.dt-cards tbody td { display: block; position: relative; min-width: 0 !important; width: auto !important; padding: 5px 0 5px 40% !important; text-align: right; border: 0; white-space: normal; overflow-wrap: anywhere; }
        table.dt-cards tbody td * { white-space: normal !important; }
        table.dt-cards tbody td [class*="max-w-["], table.dt-cards tbody td .truncate { max-width: 100%; }
        table.dt-cards tbody td > .flex, table.dt-cards tbody td > div { justify-content: flex-end; flex-wrap: wrap; }
        table.dt-cards tbody td::before { content: attr(data-label); font-family: 'Be Vietnam Pro', system-ui, sans-serif; position: absolute; left: 0; top: 7px; width: 38%; text-align: left; font-size: 12px; font-weight: 400; color: rgb(var(--muted)); }
        table.dt-cards tbody td[data-label=""], table.dt-cards tbody td:not([data-label]), table.dt-cards tbody td[colspan] { padding-left: 0 !important; text-align: left; }
        table.dt-cards tbody td[data-label=""] > .flex, table.dt-cards tbody td[data-label=""] > div { justify-content: flex-start; }
        table.dt-cards tbody td[data-label=""]::before, table.dt-cards tbody td:not([data-label])::before, table.dt-cards tbody td[colspan]::before { display: none; }
        table.dt-cards tbody td[colspan] { text-align: center; }
        table.dt-cards tbody td:first-child { font-weight: 500; }
        table.dt-cards.dt-stt > tbody > tr::before { display: none; }
        table.dt-cards tbody td[data-sel] { display: none !important; }
        table.dt-cards tbody td[data-sel] + td { font-weight: 500; }
      }
      .kpi-row > .kpi:first-child { border-left-color: transparent; padding-left: 0; }
      .glass-card > .\\-mx-5:first-child, .glass-card > .md\\:hidden:first-child + div > .\\-mx-5:first-child, .glass-card > .md\\:hidden:first-child + div > div:first-child > .\\-mx-5:first-child { margin-top: -1.25rem; }
      .glass-card > .\\-mx-5:first-child > table.dt > thead > tr { border-bottom-color: rgb(var(--ink) / 0.08); }
      @media (min-width: 1024px) { .tb40 > .relative:first-child { width: 280px; flex: none; } .tb40 > select { width: auto; max-width: 200px; } .tb40 > button:last-child { margin-left: auto; } }
      .kpi-strip { background: rgb(var(--surface)); border: 1px solid rgb(var(--line)); border-radius: 12px; overflow: hidden; }
      .kpi-strip > * { border-left: 1px solid rgb(var(--line)); border-top: 1px solid rgb(var(--line)); margin: 0 0 -1px -1px; }
      /* Card chuẩn: nền surface, viền mảnh, bóng nhẹ (thay hiệu ứng kính để dễ đọc và nhẹ máy) */
      .glass-card { background: rgb(var(--surface)); border: 1px solid rgb(var(--line)); }
      .ambient { display: none; }
      .glass { background: rgb(var(--raised) / 0.96); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: var(--shadow-lg); }
      option { background: rgb(var(--surface)); color: rgb(var(--fg)); }
      select:not([multiple]) { appearance: none; -webkit-appearance: none; padding-right: 2rem !important; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right .6rem center; background-size: 1rem; }
      :focus-visible { outline: 2px solid rgb(var(--fg) / .7); outline-offset: 2px; }
      button, a, [role=tab] { -webkit-tap-highlight-color: transparent; }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
      .chamfer { clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px); }
      ::selection { background: rgb(var(--accent) / .3); }
      @keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
      @keyframes sheetUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      @keyframes slideInLeft { from { transform: translateX(-100%) } to { transform: translateX(0) } }
      @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      @keyframes popIn { from { opacity: 0; transform: translateY(8px) scale(.98) } to { opacity: 1; transform: none } }
      @keyframes toastIn { from { opacity: 0; transform: translate(-50%, 8px) } to { opacity: 1; transform: translate(-50%, 0) } }
      @keyframes ring { 0%, 100% { transform: rotate(0) } 15% { transform: rotate(16deg) } 30% { transform: rotate(-14deg) } 45% { transform: rotate(10deg) } 60% { transform: rotate(-6deg) } 75% { transform: rotate(3deg) } }
      @keyframes blinkBorder { 0%, 100% { border-color: #EF4444; box-shadow: 0 0 0 1px rgba(239, 68, 68, .45) } 50% { border-color: rgba(239, 68, 68, .25); box-shadow: none } }
    `}</style>
    </>
  );
  const shellStyle = { fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" };

  if (!me) {
    return (
      <div className="text-[rgb(var(--fg))] antialiased" style={shellStyle}>
        {fontStyle}
        <LoginScreen onLogin={login} idleOut={idleOut ? security.idleMinutes : 0} dataLocked={dataLocked} brand={pathOrgId ? (ORGS.find((o) => o.id === pathOrgId) ?? remoteBrand) : null} choices={orgChoices} onPick={pickOrg} onCancelPick={cancelPick} />
      </div>
    );
  }

  const ctx: AppCtx = {
    platform: {
      userId: platformId, admins: platformAdmins, setAdmins: setPlatformAdmins, switchTenant, tenants: platformTenants, setTenantReg, logs: platformLogs, addTenant,
      consoleView, openConsole: (t) => { setConsoleView(true); if (t) setConsoleTab(t); }, consoleTab, setConsoleTab, runMigration: runTenantMigration, backupTenant, restoreTenantSnapshot, log: platformLog,
    }, postCash,
    me, role, loginAt, switchRole, logout, now,
    leads, setLeads, customers, setCustomers, users, setUsers, departments, setDepartments,
    budget, setBudget, budgets, setBudgets, setFiscalYear, activities, setActivities, policy, setPolicy, programs, setPrograms, claims, setClaims, perms, setPerms,
    segRules, segments, setSegments, tierRules, setTierRules, categories, setCategories, popDocs, setPopDocs, sources, setSources,
    mktItems, setMktItems, company, setCompany, quotes, setQuotes, myLeads, myCustomers: myCustomersF, gf, setGf,
    range, setRange, skus, setSkus, pos, setPos,
    docTemplates, setDocTemplates, genDocs, setGenDocs, openComposer: (o) => setComposer(o), openWin: (id) => setWinFor(id),
    reservations, moves, receiveShipment, deliverReservation, requestRelease, decideRelease, reserveFromStock, canRelease, reopenLead,
    openLeadForm: (asProject, id) => setLeadForm({ asProject, id }),
    openPalette: () => setPaletteOpen(true),
    askAi: (q) => { setHub('ai'); if (q) setHubAsk(q); },
    openHub: (t) => setHub(t),
    notify,
    intent, setIntent,
    go: (m, query = '') => { setPresetQuery(query); setPage(m); setOpenSale(null); setOpenCustomerId(null); setOpenClaimId(null); setDrawerOpen(false); window.scrollTo({ top: 0 }); },
    presetQuery,
    openClaim: (id) => setOpenClaimId(id),
    openCustomer: (id) => setOpenCustomerId(id),
    openProgramForm: (customerId, programId) => setProgramForm({ customerId, programId }),
    openCustomerForm: (id) => setCustomerForm({ id }),
    canSee: seeModule,
    moduleOn: (m) => moduleEnabled(company, m),
    approvalLogs,
    logDecision: (e) => {
      setApprovalLogs((p) => [{ ...e, id: uid('ap'), at: Date.now(), deciderId: me.id }, ...p].slice(0, 3000));
      writeAudit(`APPROVAL_${e.decision}`, `${e.title}${e.note ? `: ${e.note}` : ''}`, e.decision === 'APPROVED' ? 'INFO' : 'WARN', me.id);
    },
    auditLogs,
    audit: (action, detail, level = 'INFO') => writeAudit(action, detail, level, realUserId ?? me.id),
    security, setSecurity,
    dataInfo: { version: DATA_VERSION, savedAt, bytes: savedBytes, snapshots: snapTick >= 0 ? listSnapshots(orgId) : [] },
    org: orgOf(orgId),
    exportData: collectData,
    importData: (data, fromVersion) => {
      takeSnapshot(orgId, 'truoc-khi-nhap');
      applyData(migrateData(data, fromVersion).data);
      setDataLocked(null);
      setSnapTick((x) => x + 1);
      writeAudit('DATA_IMPORT', `Nhập bản sao lưu phiên bản ${fromVersion}`, 'SECURITY', me.id);
    },
    restoreSnapshot: (key) => {
      const raw = storage.get(key);
      if (!raw) return notify('Không tìm thấy bản chụp', 'red');
      try {
        const st = JSON.parse(raw) as StoredData;
        takeSnapshot(orgId, 'truoc-khi-khoi-phuc');
        applyData(migrateData((st.data ?? {}) as AnyRec, st.v ?? 0).data);
        setSnapTick((x) => x + 1);
        writeAudit('DATA_RESTORE', `Khôi phục bản chụp phiên bản ${st.v} lúc ${new Date(st.savedAt).toLocaleString('vi-VN')}`, 'SECURITY', me.id);
        notify('Đã khôi phục dữ liệu từ bản chụp', 'teal');
      } catch { notify('Bản chụp bị lỗi, không khôi phục được', 'red'); }
    },
    workOrders, setWorkOrders, installJobs, setInstallJobs,
    jobs, setJobs, receipts, setReceipts, stockItems, setStockItems, stockMoves, setStockMoves, cashEntries, setCashEntries, priceItems, setPriceItems, mfgConfig, setMfgConfig, openJob: setOpenJobId,
    canDo: (a) => myPerm?.actions?.[a] ?? (perms.actions[a] ?? INITIAL_PERMS.actions[a] ?? []).includes(role),
    userName, dept, routableDepts, routeLeads, acceptLead,
    getflyOrders, setGetflyOrders, getfly, setGetfly, getflyLogs, addGetflyLog, winLead, winDraftQuote, syncLeadToGetfly, recomputeLinked,
    wfAll, setWfDefs, wfRuns, setWfRuns, wfPolicy, setWfPolicy, wfDelegations, setWfDelegations, wfCtx, wfDef, wfDecide, wfSubmit, wfFinishRequest, openRequest: (id) => { setReqOpen(id); setPage('tasks'); }, reqOpen, setReqOpen, approveVoucher, wfFirstApprovers,
    salesOrders, setSalesOrders, saveSale, issueSale, completeSale, splitSale, purchaseForSale, addSalePayment, confirmSalePayment, setSaleStatus, openSale, setOpenSale,
    assignLead, submitQuote, markLost,
    notices: myNotices,
    markNoticeRead: (id) => setNotices((p) => p.map((n) => (!id || n.id === id ? { ...n, read: true } : n))),
    ringKey, dispatch, msgLogs, addMsgLog, emailCfg, setEmailCfg, zns, setZns, notifyRules, setNotifyRules, docs, setDocs, comments, patchComment: (id, fn) => setComments((p) => p.map((c) => (c.id === id ? fn(c) : c))), channels, posts, setPosts, warehouses, setWarehouses, addMoves, stockVouchers, setStockVouchers, setChannels, zaloConvs, setZaloConvs, zaloMsgs, setZaloMsgs, campaigns, setCampaigns, contents, setContents, banners, setBanners, audiences, setAudiences, automations, setAutomations, autoRuns, setAutoRuns, kb, setKb, mktTasks, setMktTasks, briefs, setBriefs, draftProducts, setDraftProducts, socialPosts, setSocialPosts, kpiTargets, setKpiTargets, contentVersions, setContentVersions, mktImages, setMktImages, aiQuota, setAiQuota, hubCfg, setHubCfg, 
    addBotComment: (c) => setComments((p) => [...p, { ...c, id: uid('cm'), at: Date.now(), authorId: 'ai-bot' }]), chatSeen: seen, markChatSeen: markSeen,
    addComment: (c, title) => {
      if (!me) return;
      const rec: RowComment = { ...c, id: uid('cm'), at: Date.now(), authorId: me.id };
      setComments((p) => [...p, rec]);
      const to = users.filter((u) => c.mentions.includes(u.id) && u.id !== me.id);
      if (to.length) setNotices((n) => [{ id: uid('n'), at: Date.now(), kind: 'MENTION' as NoticeKind, title: c.entityId.startsWith('dm:') ? `${me.name} nhắn tin cho bạn` : `${me.name} nhắc bạn: ${title}`, body: c.text.slice(0, 160), read: false, module: c.module, to: to.map((u) => u.name).join(', ') }, ...n].slice(0, 80));
    },
  };

  // ---- Badge trên menu ----
  const waiting = myLeads.filter((l) => l.status === 'NEW' || l.status === 'ROUTED').length;
  const lateAccept = myLeads.filter((l) => isAcceptLate(l, now)).length;
  const lateQuote = myLeads.filter((l) => isQuoteOverdue(l, now)).length;
  const blockedClaims = claims.filter((c) => !c.submitted && blockersOf(c, policy.rules) > 0).length;
  const badges: Partial<Record<Module, { n: number; tone: Tone }>> = {
    leads: lateAccept ? { n: lateAccept, tone: 'red' } : waiting ? { n: waiting, tone: 'orange' } : undefined,
    projects: lateQuote ? { n: lateQuote, tone: 'red' } : undefined,
    claims: blockedClaims ? { n: blockedClaims, tone: 'orange' } : undefined,
    messages: chatUnread ? { n: chatUnread, tone: 'orange' } : undefined,
    zalo: me && zaloConvs.some((z) => (z.unread ?? 0) > 0 && canSeeConv(z, me, hubCfg)) ? { n: zaloConvs.filter((z) => (z.unread ?? 0) > 0 && canSeeConv(z, me, hubCfg)).length, tone: 'red' } : undefined,
  };
  const nav = MODULES.filter((m) => seeModule(m) && moduleEnabled(company, m));
  // Thanh điều hướng dưới (mobile): 4 phân hệ ưu tiên + Menu
  const bottomNav = ((bizMode(company) === 'MFG' ? ['overview', 'leads', 'jobs', 'production', 'install', 'tasks'] : ['overview', 'tasks', 'customers', 'docs', 'staff', 'leads', 'projects']) as Module[]).filter((m) => seeModule(m) && moduleEnabled(company, m)).slice(0, 5);
  const spentPct = budget.total ? (budget.spent / budget.total) * 100 : 0;
  const commitPct = budget.total ? (budget.committed / budget.total) * 100 : 0;

  const consoleMode = !!platformId && consoleView;

  const tenantReg = platformTenants.find((t) => t.id === orgId);
  const contractLeft = tenantReg ? daysTo(tenantReg.contractEnd) : 999;
  const groups = NAV_GROUPS.map((g) => ({ ...g, title: g.id === 'supply' && bizMode(company) === 'MFG' ? 'Xưởng' : g.title, list: g.list.filter((m) => nav.includes(m) && m !== 'overview') })).filter((g) => g.list.length);
  const showDate = !consoleMode && DATE_PAGES.includes(page);

  /** Một mục menu: đầy đủ (icon + nhãn + badge) hoặc thu gọn (chỉ icon, tooltip, chấm báo) */
  const navBtn = (o: { id: string; label: string; icon: typeof Wallet; active: boolean; onClick: () => void; mini: boolean; badge?: { n: number; tone: Tone }; extra?: ReactNode }) => {
    const Icon = o.icon;
    return (
      <button
        key={o.id}
        onClick={o.onClick}
        aria-label={o.mini ? `${o.label}${o.badge ? ` (${o.badge.n})` : ''}` : undefined}
        onMouseEnter={o.mini ? (e) => { const r = e.currentTarget.getBoundingClientRect(); setRailTip({ label: `${o.label}${o.badge ? ` · ${o.badge.n}` : ''}`, y: r.top + r.height / 2 }); } : undefined}
        onMouseLeave={o.mini ? () => setRailTip(null) : undefined}
        onFocus={o.mini ? (e) => { const r = e.currentTarget.getBoundingClientRect(); setRailTip({ label: o.label, y: r.top + r.height / 2 }); } : undefined}
        onBlur={o.mini ? () => setRailTip(null) : undefined}
        aria-current={o.active ? 'page' : undefined}
        className={cn('relative flex h-[30px] w-full items-center gap-2.5 rounded-lg text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--fg)/0.5)]', o.mini ? 'justify-center px-0' : 'px-2.5', o.active ? 'bg-[rgb(var(--ink)/0.08)] text-white' : 'text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.05)] hover:text-[rgb(var(--fg))]')}
      >
        {o.active && <span className="absolute inset-y-2 -left-2.5 w-[3px] rounded-r bg-[rgb(var(--accent))]" aria-hidden />}
        <Icon className={cn('h-4 w-4 shrink-0', o.active ? 'text-white' : 'text-[rgb(var(--muted))]')} aria-hidden />
        {!o.mini && <span className="min-w-0 flex-1 truncate">{o.label}</span>}
        {!o.mini && o.badge && <span className={cn('font-mono text-xs tabular-nums', o.badge.tone === 'red' ? 'text-[#fca5a5]' : 'text-[rgb(var(--muted))]')}>{o.badge.n}</span>}
        {o.mini && o.badge && <span className={cn('absolute right-2.5 top-1.5 h-2 w-2 rounded-full', o.badge.tone === 'red' ? 'bg-[rgb(var(--danger))]' : 'bg-[rgb(var(--accent))]')} aria-hidden />}
        {!o.mini && o.extra}
      </button>
    );
  };
  const groupHead = (id: string, title: string, mini: boolean, first: boolean, folded?: boolean, onToggle?: () => void) => mini
    ? (first ? null : <div className="mx-3 mb-2 border-t border-[rgb(var(--line))]" aria-hidden />)
    : onToggle
      ? !title ? <div className="mx-1 mb-2 border-t border-[rgb(var(--ink)/0.08)]" aria-hidden /> : <button className="mb-1 flex w-full items-center gap-1 rounded px-2.5 py-0.5 text-xs text-[rgb(var(--muted))] hover:text-[rgb(var(--fg2))]" onClick={onToggle} aria-expanded={!folded} aria-controls={`nav-${id}`}><span className="min-w-0 flex-1 truncate text-left">{title}</span><ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', folded && '-rotate-90')} aria-hidden /></button>
      : <p className="mb-1 px-2.5 text-xs text-[rgb(var(--muted))]">{title}</p>;

  const navList = (onPick?: () => void, mini = false) => consoleMode ? (
    <nav className="space-y-4" aria-label="3A Platform Console">
      <div>
        {groupHead('console', 'Nền tảng', mini, true)}
        <div className="space-y-0.5">{CONSOLE_TABS.map((t) => navBtn({ id: t.id, label: t.label, icon: t.icon, active: consoleTab === t.id, mini, onClick: () => { setConsoleTab(t.id); onPick?.(); window.scrollTo({ top: 0 }); } }))}</div>
      </div>
      <div>
        {groupHead('jump', 'Truy cập doanh nghiệp', mini, false)}
        <div className="space-y-0.5">{ORGS.map((o) => {
          const r = platformTenants.find((x) => x.id === o.id);
          return navBtn({ id: o.id, label: `${o.shortName} Instance`, icon: o.profile === 'MANUFACTURING' ? Factory : Building2, active: false, mini, onClick: () => { switchTenant(o.id); onPick?.(); },
            extra: <span className={cn('h-2 w-2 shrink-0 rounded-full', r?.status === 'SUSPENDED' ? 'bg-[rgb(var(--danger))]' : 'bg-[rgb(var(--success))]')} title={r?.status === 'SUSPENDED' ? 'Tạm dừng' : 'Hoạt động'} /> });
        })}</div>
      </div>
    </nav>
  ) : (
    <nav className={mini ? 'space-y-1.5' : 'space-y-3.5'} aria-label="Điều hướng chính">
      {nav.includes('overview') && <div className="space-y-0.5">{navBtn({ id: 'overview', label: MODULE_SHORT.overview ?? MODULE_LABEL.overview, icon: MODULE_ICON.overview, active: page === 'overview', mini, badge: badges.overview, onClick: () => { ctx.go('overview'); onPick?.(); } })}</div>}
      {groups.map((g, gi) => {
        const folded = !mini && foldGroups.includes(g.id) && !g.list.includes(page);
        return (
          <div key={g.id}>
            {groupHead(g.id, g.title, mini, gi === 0, folded, () => toggleGroup(g.id))}
            {!folded && (
              <div id={`nav-${g.id}`} className="space-y-px">
                {g.list.map((m) => navBtn({ id: m, label: MODULE_SHORT[m] ?? MODULE_LABEL[m], icon: MODULE_ICON[m], active: page === m, mini, badge: badges[m], onClick: () => { ctx.go(m); onPick?.(); }, extra: m === 'tasks' ? <TaskBadge /> : undefined }))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  const holdSum = receipts.filter((r) => r.status === 'HOLDING').reduce((s, r) => s + r.amount, 0);
  const pendSum = receipts.filter((r) => r.status === 'SUBMITTED').reduce((s, r) => s + r.amount, 0);
  const fundCard = bizMode(company) === 'MFG' ? (
    <button className="w-full rounded p-2.5 text-left hover:bg-[rgb(var(--ink)/0.04)]" onClick={() => ctx.go('tasks')}>
      <p className="text-xs text-[rgb(var(--muted))]">Tiền chưa về quỹ</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{compact(holdSum + pendSum)}</p>
      <p className="text-xs text-[rgb(var(--muted))]">Nhân viên giữ {compact(holdSum)}, chờ xác nhận {compact(pendSum)}</p>
    </button>
  ) : (
    <button className="w-full rounded p-2.5 text-left hover:bg-[rgb(var(--ink)/0.04)]" onClick={() => ctx.go(perms.modules[role].claims ? 'claims' : 'overview')}>
      <p className="text-xs text-[rgb(var(--muted))]">Quỹ 3M {budget.fiscalYear} (MDF + CS)</p>
      <p className="font-display mt-1 text-xl font-semibold"><span className="g-brand-text">{spentPct.toFixed(0)}%</span> <span className="text-xs font-medium text-[rgb(var(--muted))]">đã tiêu</span></p>
      <p className="text-xs tabular-nums text-[rgb(var(--muted))]">{compact(budget.spent)} / {compact(budget.total)}</p>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-[rgb(var(--bg))]">
        <div style={{ width: `${spentPct}%`, background: GRAD }} />
        <div style={{ width: `${commitPct}%`, background: `${C.orange}55` }} />
      </div>
    </button>
  );

  const brand = consoleMode ? (
    <div className="flex min-w-0 items-center gap-3">
      <Logo3A size={30} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium leading-tight text-white">3A Console</p>
        <p className="truncate text-xs text-[rgb(var(--muted))]">Quản trị nền tảng</p>
      </div>
    </div>
  ) : (
    <div className="flex min-w-0 items-center gap-3">
      <BrandMark size={32} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium leading-tight text-white">{company.shortName}</p>
        <p className="truncate text-xs text-[rgb(var(--muted))]">{(company.profile ?? 'TRADING') === 'TRADING' ? `${company.shortName} x 3M Việt Nam` : BUSINESS_PROFILE[company.profile ?? 'TRADING'].label}</p>
      </div>
    </div>
  );

  const switcher = platformId
    ? <TenantSwitcher orgId={orgId} consoleOn={consoleMode} onConsole={() => ctx.platform.openConsole()} onSwitch={switchTenant}>{brand}</TenantSwitcher>
    : null;
  const whoName = me?.name ?? platformUser?.name ?? platformUser?.email ?? '';

  return (
    <Ctx.Provider value={ctx}>
      <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--fg))] antialiased" style={shellStyle}>
        {fontStyle}
        <a href="#noi-dung" className="skip-link">Bỏ qua, tới nội dung</a>
        {cloudBusy && <div className="fixed inset-x-0 top-16 z-50 flex justify-center"><p className="mt-2 flex items-center gap-2 rounded-full border border-[rgb(var(--accent)/0.4)] bg-[rgb(var(--surface))] px-4 py-1.5 text-xs text-[rgb(var(--accent-fg))] shadow-xl" role="status"><RefreshCw className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />Đang tải dữ liệu từ máy chủ…</p></div>}
        <div className="flex">
          {/* ---------- Sidebar: mặc định chỉ icon, rê chuột / focus thì mở rộng nổi trên nội dung; ghim để luôn mở ---------- */}
          <aside className={cn('side-dark sticky top-0 z-50 hidden h-screen shrink-0 transition-[width] duration-200 lg:block', sideMini ? 'w-16' : 'w-60')} aria-label="Menu chính">
            <div
              className={cn('absolute inset-y-0 left-0 flex flex-col overflow-hidden border-r border-[rgb(var(--ink)/0.06)] bg-[rgb(var(--sunken))] transition-[width] duration-200', sideOpen ? 'w-60' : 'w-16')}
              onScroll={() => setRailTip(null)}
            >
              <div className={cn('flex h-14 shrink-0 items-center border-b border-[rgb(var(--ink)/0.06)]', sideOpen ? 'px-4' : 'justify-center px-0')}>
                {sideOpen ? (switcher ?? brand) : (consoleMode ? <Logo3A size={30} /> : <BrandMark size={32} />)}
              </div>
              <div className={cn('flex-1 overflow-y-auto overflow-x-hidden py-3 [scrollbar-width:thin]', sideOpen ? 'px-2.5' : 'px-2')}>
                {navList(() => setRailTip(null), !sideOpen)}
              </div>
              <div className={cn('flex shrink-0 items-center gap-2 border-t border-[rgb(var(--ink)/0.06)] py-2.5', sideOpen ? 'px-3' : 'justify-center')}>
                {sideOpen && whoName && <Avatar name={whoName} size={24} />}
                {sideOpen && <span className="min-w-0 flex-1 truncate text-[13px] text-[rgb(var(--fg2))]">{whoName || 'Nền tảng 3A Group'}</span>}
                <button className="rounded p-1 text-[rgb(var(--muted))] hover:bg-[rgb(var(--secondary)/0.2)] hover:text-[rgb(var(--fg))]" onClick={() => { setRailTip(null); toggleSide(); }} aria-pressed={!sideMini} aria-label={sideMini ? 'Mở rộng menu (Ctrl + B)' : 'Thu gọn menu (Ctrl + B)'}
                  onMouseEnter={sideMini ? (e) => { const r = e.currentTarget.getBoundingClientRect(); setRailTip({ label: 'Mở rộng menu (Ctrl + B)', y: r.top + r.height / 2 }); } : undefined} onMouseLeave={() => setRailTip(null)}>
                  {sideMini ? <PanelLeftOpen className="h-4 w-4" aria-hidden /> : <PanelLeftClose className="h-4 w-4" aria-hidden />}
                </button>
              </div>
            </div>
          </aside>
          {railTip && sideMini && <div role="tooltip" className="pointer-events-none fixed left-[4.5rem] z-[90] -translate-y-1/2 whitespace-nowrap rounded-md bg-[#0F172A] px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg motion-safe:animate-[fadeIn_.1s_ease-out]" style={{ top: railTip.y }}><span className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-[#0F172A]" aria-hidden />{railTip.label}</div>}

          <div className="min-w-0 flex-1">
        {/* ---------- Thanh trên cùng: breadcrumb (3A Group › doanh nghiệp ▾ › phân hệ) · Spotlight ⌘K · công cụ ---------- */}
        <header className="sticky top-0 z-40 border-b border-[rgb(var(--line))] bg-[rgb(var(--surface))] pt-[env(safe-area-inset-top)]">
          <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
            <button className={cn(btnGhost, 'p-2 lg:hidden')} onClick={() => setDrawerOpen(true)} aria-label="Mở menu"><Menu className="h-5 w-5" /></button>
            <div className="flex min-w-0 shrink items-center gap-2">
              {switcher && <div className="lg:hidden">{switcher}</div>}
              <h1 className="truncate text-base font-medium leading-tight lg:text-lg">{consoleMode ? (consoleTab === 'overview' ? 'Tổng quan nền tảng' : CONSOLE_TABS.find((t) => t.id === consoleTab)?.label ?? '3A Platform Console') : (MODULE_SHORT[page] ?? MODULE_LABEL[page])}</h1>
            </div>
            <div className="hidden min-w-0 flex-1 justify-end px-2 lg:flex">
{page === 'home' && !consoleMode ? <AssistantCommandBar variant="header" /> : <>
<div className="relative w-full max-w-[420px]" onDragOver={(e) => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); }} onDrop={(e) => { const f = e.dataTransfer.files?.[0]; if (f) { e.preventDefault(); setPaletteImg(f); setPaletteOpen(true); } }}>
              <button className="flex h-9 w-full items-center gap-3 rounded-lg bg-[rgb(var(--raised))] px-3 pr-2 text-left text-sm text-[rgb(var(--muted))] transition-colors hover:text-[rgb(var(--fg2))]" onClick={() => setPaletteOpen(true)} title="Spotlight: tìm nhanh, gõ > để chạy lệnh (Ctrl / ⌘ + K), kéo thả ảnh để tìm sản phẩm tương tự">
                <Search className="h-4 w-4 shrink-0" aria-hidden /><span className="min-w-0 flex-1 truncate">Tìm khách hàng, MST, mã đơn</span>
                <span className="w-8 shrink-0" aria-hidden /><kbd className="flex shrink-0 items-center gap-0.5 rounded-sm border border-[rgb(var(--ink)/0.1)] px-1.5 py-0.5 text-[11px]"><Command className="h-3 w-3" aria-hidden />K</kbd>
              </button>
                <button className="absolute right-[3.25rem] top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-[rgb(var(--muted))] hover:bg-[rgb(var(--ink)/0.06)] hover:text-[rgb(var(--accent-fg))]" onClick={() => { setPaletteImg('pick'); setPaletteOpen(true); }} title="Tìm bằng hình ảnh: ảnh mẫu, bản vẽ, phụ kiện" aria-label="Tìm bằng hình ảnh"><Camera className="h-4 w-4" /></button>
              </div>
            </>}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 lg:ml-0">
              {showDate && <div className={hub ? '' : 'lg:hidden'}><DateRangePicker compact /></div>}
              {showDate && <div className={cn('hidden', !hub && 'lg:block')} title="Kỳ dữ liệu áp dụng cho các phân hệ"><DateRangePicker /></div>}
              <button className={cn(btnGhost, 'p-2 lg:hidden')} onClick={() => setPaletteOpen(true)} aria-label="Tìm kiếm"><Search className="h-5 w-5" /></button>
              {CLOUD_ON && syncInfo && <SyncChip info={syncInfo} />}
              {/* Nhóm icon chức năng: Sáng/Tối · Chat · AI */}
              <div className="hidden items-center rounded-md border border-[rgb(var(--ink)/0.08)] bg-[rgb(var(--ink)/0.02)] p-0.5 sm:flex" role="group" aria-label="Công cụ">
                <button className="rounded p-1.5 text-[rgb(var(--muted))] transition-colors hover:bg-[rgb(var(--ink)/0.06)] hover:text-[rgb(var(--fg))]" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} aria-label={theme === 'dark' ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối'} title={theme === 'dark' ? 'Nền sáng' : 'Nền tối'}>
                  {theme === 'dark' ? <Moon className="h-[18px] w-[18px]" aria-hidden /> : <Sun className="h-[18px] w-[18px]" aria-hidden />}
                </button>
                {!consoleMode && (
                  <div className="flex items-center">
                    <button className={cn('relative rounded p-1.5 transition-colors hover:bg-[rgb(var(--ink)/0.06)] hover:text-[rgb(var(--fg))]', hub === 'chat' ? 'bg-[rgb(var(--ink)/0.08)] text-[rgb(var(--fg))]' : 'text-[rgb(var(--muted))]')} onClick={() => setHub((h) => (h === 'chat' ? null : 'chat'))} aria-pressed={hub === 'chat'} aria-label={`Chat nội bộ${chatUnread ? `, ${chatUnread} tin chưa đọc` : ''}`} title="Chat nhanh">
                      <MessageSquare className="h-[18px] w-[18px]" aria-hidden />{chatUnread > 0 && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-[rgb(var(--accent))] ring-2 ring-[rgb(var(--bg))]" aria-hidden />}
                    </button>
                    <button className={cn('rounded p-1.5 transition-colors hover:bg-[rgb(var(--ink)/0.06)] hover:text-[rgb(var(--fg))]', hub === 'ai' ? 'bg-[rgb(var(--ink)/0.08)] text-[rgb(var(--fg))]' : 'text-[rgb(var(--muted))]')} onClick={() => setHub((h) => (h === 'ai' ? null : 'ai'))} aria-pressed={hub === 'ai'} aria-label="AI Copilot" title="AI Copilot"><Sparkles className="h-[18px] w-[18px]" aria-hidden /></button>
                  </div>
                )}
              </div>
              {!consoleMode && <NotificationBell />}
              <UserMenu theme={theme} onTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} roleSwitch={security.roleSwitch && realUser?.role === 'BOD' && !consoleMode ? { role, onRole: switchRole } : undefined} />
            </div>
          </div>
        </header>

        {CLOUD_ON && dataLocked && <p className="bg-[rgb(var(--danger)/0.15)] px-4 py-2 text-center text-xs text-[rgb(var(--danger-fg))]" role="alert">Dữ liệu trên máy chủ thuộc phiên bản v{dataLocked}, mới hơn bản app đang mở (v{DATA_VERSION}). Đang ở chế độ chỉ xem; tải lại trang để dùng bản app mới nhất.</p>}
          <div className="ambient pointer-events-none fixed inset-0 -z-0" aria-hidden />
          <main id="noi-dung" tabIndex={-1} className={cn('relative min-w-0 flex-1 outline-none lg:pb-0', consoleMode ? 'pb-[env(safe-area-inset-bottom)]' : 'pb-[calc(5rem+env(safe-area-inset-bottom))]')}>
            <div className="mx-auto w-full max-w-[1680px] px-3 py-5 sm:px-6 lg:px-8">
              {!consoleMode && tenantReg && contractLeft <= 30 && (role === 'BOD' || !!platformId) && (
                <p className={cn('mb-4 flex items-center gap-2 rounded border px-3 py-2 text-sm', contractLeft < 0 ? 'border-[rgb(var(--danger)/0.5)] bg-[rgb(var(--danger)/0.1)] text-[rgb(var(--danger-fg))]' : 'border-[rgb(var(--accent)/0.4)] bg-[rgb(var(--accent)/0.1)] text-[rgb(var(--accent-fg))]')} role="status">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                  {contractLeft < 0 ? `Hợp đồng bản quyền 3A Group đã quá hạn ${-contractLeft} ngày (${fmtDate(tenantReg.contractEnd)}).` : `Hợp đồng bản quyền 3A Group hết hạn ngày ${fmtDate(tenantReg.contractEnd)} (còn ${contractLeft} ngày).`} Liên hệ 3A Group để gia hạn.
                </p>
              )}
              {consoleMode ? <PlatformConsole /> : (
                cloudBusy ? <Skeleton /> : (
                <ModuleBoundary key={`${page}-${presetQuery}`} name={MODULE_LABEL[page]} onHome={() => ctx.go('overview')}>
                <div>
                  {page === 'overview' && <OverviewPage />}
                  {page === 'tasks' && <TasksModule />}
                  {page === 'leads' && (bizMode(company) === 'MFG' ? <MfgLeadsPage /> : <LeadsModule />)}
                  {page === 'customers' && (bizMode(company) === 'MFG' ? <MfgCustomersPage /> : <CustomersPage />)}
                  {page === 'projects' && <ProjectsPage />}
                  {page === 'products' && <SkuCatalog />}
                  {page === 'supply' && <SupplyModule />}
                  {page === 'claims' && <ClaimsModule />}
                  {page === 'jobs' && <JobsModule />}
                  {page === 'production' && <ProductionModule />}
                  {page === 'install' && <InstallModule />}
                  {page === 'inventory' && <InventoryModule />}
                  {page === 'cashbook' && <CashbookModule />}
                  {page === 'staff' && <StaffModule />}
                  {page === 'docs' && <DocsModule />}
                  {page === 'reports' && <ReportsPage />}
                  {page === 'sales' && <SalesModule />}
                  {page === 'settings' && <SettingsModule />}
                  {page === 'messages' && <MessengerPage />}
                  {page === 'zalo' && <ZaloHubPage />}
                  {page === 'marketing' && <MarketingHubPage />}
                  {page === 'contacts' && <ContactsPage />}
                  {page === 'warehouse' && <WarehouseModule />}
                  {page === 'home' && <HomePage />}
                </div>
                </ModuleBoundary>
                )
              )}
            </div>
          </main>
          </div>
          {/* ---------- Cột phải: Chat nội bộ & AI Copilot (neo cố định trên màn rộng, không che dữ liệu) ---------- */}
          {hub && !consoleMode && (
            <>
              <div className="fixed inset-0 z-[60] bg-black/40 xl:hidden" onClick={() => setHub(null)} aria-hidden />
              <aside className="fixed inset-y-0 right-0 z-[61] w-full motion-safe:animate-[slideIn_.2s_ease-out] sm:w-[400px] xl:sticky xl:top-0 xl:z-30 xl:h-screen xl:w-[380px] xl:shrink-0 xl:animate-none" aria-label="Trung tâm trao đổi">
                <CommHub tab={hub} onTab={setHub} onClose={() => setHub(null)} ask={hubAsk} onAsked={() => setHubAsk(null)} seen={seen} markSeen={markSeen} />
              </aside>
            </>
          )}
        </div>

        {/* ---------- Widget nổi: Quỹ 3M / tiền chưa về quỹ (desktop) ---------- */}
        {!consoleMode && fundOpen && (
          <div className={cn('fixed bottom-5 right-5 z-30 hidden lg:block', hub && 'xl:right-[400px]')}>
              <div className="glass w-64 rounded-md border border-[rgb(var(--ink)/0.08)] p-1 shadow-[0_16px_40px_rgba(0,0,0,.45)] motion-safe:animate-[popIn_.18s_ease-out]">
                <div className="flex items-center justify-between px-2 pt-1">
                  <span className="text-[11px] font-semibold text-[rgb(var(--faint))]">Theo dõi nhanh</span>
                  <button className="rounded p-0.5 text-[rgb(var(--muted))] hover:bg-[rgb(var(--ink)/0.1)] hover:text-[rgb(var(--fg))]" onClick={() => setFundOpen(false)} aria-label="Thu nhỏ widget"><ChevronDown className="h-4 w-4" aria-hidden /></button>
                </div>
                {fundCard}
              </div>
          </div>
        )}

        {/* ---------- Thanh điều hướng dưới (mobile) ---------- */}
        {!consoleMode && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[rgb(var(--line))] bg-[rgb(var(--sunken)/0.95)] pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Điều hướng nhanh">
          <div className="grid grid-cols-6">
            {bottomNav.map((m) => {
              const Icon = MODULE_ICON[m];
              const b = badges[m];
              return (
                <button key={m} onClick={() => ctx.go(m)} className={cn('relative flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium', page === m ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--muted))]')} aria-current={page === m ? 'page' : undefined}>
                  <Icon className="h-5 w-5" aria-hidden />
                  <span className="block w-full truncate px-0.5 text-center">{MODULE_SHORT[m] ?? MODULE_LABEL[m]}</span>
                  {b && <span className={cn('absolute right-[22%] top-2 h-2 w-2 rounded-full', b.tone === 'red' ? 'bg-[rgb(var(--danger))]' : 'bg-[rgb(var(--accent))]')} aria-label={`${b.n} việc cần xử lý`} />}
                  {m === 'tasks' && <TaskBadge dot />}
                </button>
              );
            })}
            <button onClick={() => setDrawerOpen(true)} className={cn('flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium', !bottomNav.includes(page) ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--muted))]')}>
              <Menu className="h-5 w-5" aria-hidden /><span>Menu</span>
            </button>
          </div>
        </nav>
        )}

        {/* ---------- Ngăn menu (mobile) ---------- */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="absolute inset-0 bg-black/60 motion-safe:animate-[fadeIn_.15s_ease-out]" onClick={() => setDrawerOpen(false)} />
            <aside className="side-dark absolute inset-y-0 left-0 flex w-[min(300px,85vw)] flex-col border-r border-[rgb(var(--line))] bg-[rgb(var(--sunken))] pt-[env(safe-area-inset-top)] motion-safe:animate-[slideInLeft_.2s_ease-out]">
              <div className="flex items-center justify-between gap-2 px-4 py-4">
                {brand}
                <button className={cn(btnGhost, 'p-2')} onClick={() => setDrawerOpen(false)} aria-label="Đóng menu"><X className="h-4 w-4" /></button>
              </div>
              {security.roleSwitch && realUser?.role === 'BOD' && !consoleMode && (
                <div className="px-4 pb-3">
                  <label className="mb-1 block text-xs text-[rgb(var(--muted))]" htmlFor="role-mobile">Xem với vai trò</label>
                  <select id="role-mobile" className={inputCls} value={role} onChange={(e) => switchRole(e.target.value as Role)}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </div>
              )}
              <div className="flex-1 overflow-y-auto px-3">
                {navList(() => setDrawerOpen(false))}
              </div>
              <div className="space-y-2 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
                {!consoleMode && (
                  <div className="grid grid-cols-3 gap-2">
                    <button className={cn(btnGhost, 'relative flex-col gap-1 py-2 text-xs')} onClick={() => { setDrawerOpen(false); setHub('chat'); }}><MessageSquare className="h-4 w-4" aria-hidden />Chat{chatUnread > 0 && <span className="g-brand absolute right-1.5 top-1 rounded-full px-1 text-[11px] font-semibold text-[rgb(var(--on-accent))]">{chatUnread}</span>}</button>
                    <button className={cn(btnGhost, 'flex-col gap-1 py-2 text-xs')} onClick={() => { setDrawerOpen(false); setHub('ai'); }}><Sparkles className="h-4 w-4 text-[rgb(var(--accent-fg))]" aria-hidden />AI Copilot</button>
                    <button className={cn(btnGhost, 'flex-col gap-1 py-2 text-xs')} onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>{theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}{theme === 'dark' ? 'Nền sáng' : 'Nền tối'}</button>
                  </div>
                )}
                {!consoleMode && fundCard}
                <button className={cn(btnBase, 'w-full border border-[rgb(var(--danger)/0.4)] px-3 py-2.5 text-[rgb(var(--danger-fg))]')} onClick={logout}><LogOut className="h-4 w-4" aria-hidden />Đăng xuất</button>
              </div>
            </aside>
          </div>
        )}

        {openCustomerId && <CustomerDrawer id={openCustomerId} onClose={() => setOpenCustomerId(null)} />}
        {openClaimId && <ClaimDrawer key={openClaimId} id={openClaimId} onClose={() => setOpenClaimId(null)} />}
        {programForm && <ProgramFormModal customerId={programForm.customerId} programId={programForm.programId} onClose={() => setProgramForm(null)} />}
        {customerForm && <CustomerFormModal id={customerForm.id} onClose={() => setCustomerForm(null)} />}
        {leadForm && <LeadFormModal id={leadForm.id} asProject={leadForm.asProject} onClose={() => setLeadForm(null)} />}
        <AiChatBot />
        <AutomationEngine />
        <AiContentWorker />
        <ContentReviewHost />
        {paletteOpen && <CommandPalette image={paletteImg} onClose={() => { setPaletteOpen(false); setPaletteImg(null); }} onAsk={(q) => { setHub('ai'); setHubAsk(q); }} extra={[
          { id: 'x-side', group: 'Giao diện', label: sideMini ? 'Ghim menu trái luôn mở' : 'Thu gọn menu trái', icon: sideMini ? PanelLeftOpen : PanelLeftClose, run: toggleSide, keys: 'sidebar menu' },
          { id: 'x-fund', group: 'Giao diện', label: fundOpen ? 'Thu nhỏ widget theo dõi quỹ' : 'Mở widget theo dõi quỹ', icon: Wallet, run: () => setFundOpen((v) => !v), keys: 'quy 3m widget' },
          ...(platformId ? [
            { id: 'x-console', group: 'Không gian làm việc', label: 'Mở 3A Platform Console', icon: Globe, run: () => ctx.platform.openConsole() },
            ...ORGS.map((o) => ({ id: `x-org-${o.id}`, group: 'Không gian làm việc', label: `Chuyển sang ${o.shortName} Instance`, icon: o.profile === 'MANUFACTURING' ? Factory : Building2, run: () => switchTenant(o.id) })),
          ] : []),
        ]} />}
        {mustChange && <ChangePasswordModal forced onClose={() => setMustChange(false)} />}
        {openJobId && <JobDrawer key={openJobId} id={openJobId} onClose={() => setOpenJobId(null)} />}
        {winFor && <WinModal leadId={winFor} onClose={() => setWinFor(null)} />}
        {composer && <DocComposerModal key={`${composer.docId ?? ''}${composer.leadId ?? ''}${composer.customerId ?? ''}${composer.quoteId ?? ''}${composer.mode ?? ''}${composer.view ? 'v' : ''}${composer.edit ? 'e' : ''}${composer.reviseOf ?? ''}`} mode={composer.mode} leadId={composer.leadId} customerId={composer.customerId} docId={composer.docId} quoteId={composer.quoteId} view={composer.view} edit={composer.edit} reviseOf={composer.reviseOf} onClose={() => setComposer(null)} />}

        {toast && (
          <div key={toast.id} role={toast.tone === 'red' ? 'alert' : 'status'} className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-[80] flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-start gap-3 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--raised))] px-4 py-3 text-sm shadow-[var(--shadow-lg)] motion-safe:animate-[toastIn_.2s_ease-out] lg:bottom-6">
            {toast.tone === 'teal' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--success-fg))]" aria-hidden /> : toast.tone === 'red' ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--danger-fg))]" aria-hidden /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--accent-fg))]" aria-hidden />}
            <span className="min-w-0 flex-1">{toast.msg}</span>
            {toast.action && <button className="shrink-0 rounded px-2 py-0.5 text-sm font-semibold text-[rgb(var(--secondary-fg))] hover:bg-[rgb(var(--secondary)/0.12)]" onClick={() => { toast.action?.run(); setToast(null); }}>{toast.action.label}</button>}
            <button className="shrink-0 rounded p-0.5 text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]" onClick={() => setToast(null)} aria-label="Đóng thông báo"><X className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

