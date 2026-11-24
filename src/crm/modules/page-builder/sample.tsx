'use client';

// Bộ vẽ trang — dữ liệu mẫu cho 3A Studio (v55.2.1): khối nghiệp vụ xem trước bằng chính component thật của doanh nghiệp
// (bảng Quản lý đơn hàng thật, form / chi tiết qua DynamicFieldRenderer) thay vì HTML mẫu vẽ tay.
// Ngữ cảnh mẫu không đọc dữ liệu doanh nghiệp, không ghi gì: mọi hàm ghi là no-op, vùng hiển thị đặt `inert` (không bấm / nhập được).
import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { Ctx, cfSample, EMPTY_CUSTOMER, L_SO_LINES, todayISO, useApp } from '../../lib/core';
import type { AppCtx, CfDef, CfEntity, CfVal, Customer, Lead, SalesOrder, User } from '../../lib/types';

const U_SAMPLE = 'u-sample-bao';

/** Đơn mẫu (cùng nội dung với đơn mẫu DH201126-02 của trang Chi tiết đơn) */
export function lSampleOrders(cf: CfDef[]): SalesOrder[] {
  const today = todayISO();
  const cfv: Record<string, CfVal> = Object.fromEntries(cf.filter((d) => d.scope === 'HEAD' && d.status === 'ACTIVE').map((d) => [d.key, d.type === 'money' ? 1500000 : d.type === 'number' ? 12 : d.type === 'check' ? true : cfSample(d)]));
  const line = (i: number, qty: number) => { const l = L_SO_LINES[i % L_SO_LINES.length]; return { id: `sl-s${i}-${qty}`, kind: 'SKU' as const, ref: l.ref, name: l.name, unit: l.unit, qty, price: l.price, discountPct: l.ck, vat: l.vat }; };
  const o = (n: number, cust: string, cid: string, qty: number, paid: number, st: SalesOrder['status'], appr: boolean): SalesOrder => ({
    id: `so-sample-${n}`, code: `DH${today.slice(8, 10)}${today.slice(5, 7)}${today.slice(2, 4)}-0${n}`, createdAt: Date.now() - n * 36e5, date: today, source: 'COUNTER',
    customerId: cid, customer: cust, lines: [line(n, qty)], pay: paid ? 'CASH' : 'CREDIT', creditDays: paid ? 0 : 30,
    payments: paid ? [{ id: `sp-s${n}`, amount: paid, method: 'CASH', at: Date.now(), date: today, confirmed: true } as SalesOrder['payments'][number]] : [],
    delivery: 'PICKUP', whId: 'wh-main', invoice: n % 2 === 0, status: st, by: U_SAMPLE, origin: 'Tại quầy', cf: cfv,
    ...(appr ? { approval: { status: 'PENDING' as const, reasons: ['Chiết khấu vượt ngưỡng'], requestedAt: Date.now(), requestedBy: U_SAMPLE } } : {}),
  } as SalesOrder);
  return [o(4, 'Xưởng Nhôm kính Phú Quý', 'c-s4', 8, 0, 'PENDING', true), o(3, 'Cửa hàng Vật tư điện Phúc An', 'c-s3', 30, 0, 'PENDING', false), o(2, 'NPP Hoàng Phát', 'c-s2', 5, 500000, 'PENDING', false), o(1, 'Tổng thầu Điện Thành', 'c-s1', 12, 3661200, 'DONE', false)];
}

/** Ngữ cảnh ứng dụng mẫu bao quanh component thật khi xem trước trong 3A Studio */
export function SampleApp({ children }: { children: ReactNode }) {
  const app = useApp();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.setAttribute('inert', ''); }, []);
  const v = useMemo((): AppCtx => {
    const cf = app.platform.customFields.filter((d) => d.entity === 'sale');
    const orders = lSampleOrders(cf);
    // v55.3: khách hàng / lead mẫu (cho bảng thật của Danh sách khách hàng, Data MKT), có giá trị mẫu cho trường tùy chỉnh
    const cfOf = (ent: CfEntity) => Object.fromEntries(app.platform.customFields.filter((d) => d.entity === ent && d.scope === 'HEAD' && d.status === 'ACTIVE').map((d) => [d.key, d.type === 'money' ? 1500000 : d.type === 'number' ? 12 : d.type === 'check' ? true : cfSample(d)])) as Record<string, CfVal>;
    const cust = orders.map((x, i) => ({ ...EMPTY_CUSTOMER, id: x.customerId!, code: `KH-0000${12 + i}`, name: x.customer, taxCode: `01012345${60 + i}`, contactName: 'Anh Phát', contactPhone: '0903 112 245', amId: U_SAMPLE, ytdRevenue: (i + 1) * 120e6, debt: i * 40e6, creditLimit: 500e6, createdAt: todayISO(), cf: cfOf('customer') } as Customer));
    const leads = ['Công ty Xây lắp Minh Long', 'Nhà máy Thép Phú Mỹ', 'Khách sạn Biển Xanh'].map((name, i) => ({ id: `l-sample-${i}`, code: `LD-2026-00${41 + i}`, company: name, contact: 'Chị Hạnh', phone: '0912 345 678', taxCode: `031234567${i}`, segment: 'OTHER', source: 'WEBSITE_FORM', region: 'SOUTH', boqValue: (i + 2) * 85e6, boqNote: '', attachments: [], receivedDaysAgo: i, status: 'NEW', cf: cfOf('lead') } as unknown as Lead));
    const bao = { id: U_SAMPLE, name: 'Trần Quốc Bảo', email: 'sales@mau.vn', role: 'SALES_REP', active: true, approvalLimit: 0, title: 'Nhân viên kinh doanh' } as User;
    const noop = () => undefined;
    return { ...app, mySales: orders, salesOrders: orders, customers: cust, myCustomers: cust, leads, myLeads: leads, setLeads: noop, setCustomers: noop, users: [...app.users.filter((u) => u.id !== U_SAMPLE), bao], quotes: [], stockVouchers: [], myPrefs: {}, setMyPref: noop, setOpenSale: noop, setSalesOrders: noop, notify: noop };
  }, [app]);
  return <Ctx.Provider value={v}><div ref={ref} className="select-none" aria-label="Xem trước dữ liệu mẫu">{children}</div></Ctx.Provider>;
}

/** v55.3 Giá trị mẫu của trường gốc trên khối Chi tiết (3A Studio) */
const BUILTIN_SAMPLE: Record<CfEntity, Record<string, string>> = {
  sale: { customer: 'NPP Hoàng Phát', code: 'DH201126-02', origin: 'Tại quầy', by: 'Trần Quốc Bảo', wh: 'Kho Tổng Hà Nội', docRef: 'PO-HP-1125', invNo: '—' },
  customer: { code: 'KH-000012', name: 'NPP Hoàng Phát', taxCode: '0101234567', segment: 'Đại lý', tier: 'Vàng', region: 'Miền Bắc', dept: 'Kinh doanh', amId: 'Trần Quốc Bảo', contactName: 'Anh Phát', contactPhone: '0903 112 245', contactEmail: 'phat@hoangphat.vn', address: 'Lô C5, KCN Tân Bình', creditLimit: '500.000.000', debt: '124.000.000' },
  lead: { code: 'LD-0042', company: 'Công ty Xây lắp Minh Long', contact: 'Chị Hạnh', phone: '0912 345 678', email: 'hanh@minhlong.vn', taxCode: '0312345678', segment: 'Dự án', source: 'Website', region: 'Miền Nam', province: 'TP Hồ Chí Minh' },
  product: {},
};
export const lBuiltinSample = (entity: CfEntity, key: string): string => BUILTIN_SAMPLE[entity][key] ?? '—';
