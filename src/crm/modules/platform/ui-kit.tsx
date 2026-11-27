'use client';

import { type ReactNode, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, CheckCircle2, Download, FileText, Inbox, Plus, Printer, RotateCcw, ShoppingBag, Truck, Upload, Users, Wallet } from 'lucide-react';
import { Field } from '../../components/ui';
import { EmptyState, PageHeader, SlideOverDrawer, SmartDataTable, StatKpiCard, StatusBadge, StatusBar, WorkflowStepper, kCard, type ActiveFilter, type DataCol, type StatusOpt, type StatusTone, type WorkflowStep } from '../../components/kit';
import { btnGhost, inputCls } from '../../lib/core';
import { cn } from '../../lib/utils';

// =====================================================================
//  v59 Console › Bộ giao diện: trưng bày token + 7 thành phần lõi bằng dữ liệu mẫu (không đọc dữ liệu doanh nghiệp)
//  Đây cũng là trang kiểm tra trực quan Sáng / Tối trước khi áp dụng thành phần vào từng module.
// =====================================================================

type Demo = { id: string; code: string; date: string; customer: string; rep: string; status: DemoSt; net: number; vat: number; paid: number };
type DemoSt = 'PENDING' | 'APPROVED' | 'SHIPPING' | 'DONE' | 'CANCELLED';

const ST: Record<DemoSt, { label: string; tone: StatusTone }> = {
  PENDING: { label: 'Chờ duyệt', tone: 'accent' },
  APPROVED: { label: 'Đã duyệt', tone: 'info' },
  SHIPPING: { label: 'Đang giao', tone: 'warning' },
  DONE: { label: 'Hoàn thành', tone: 'success' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
};

const CUS = ['Công ty TNHH Ánh Dương', 'Cửa hàng Minh Long', 'Đại lý Phúc An', 'Công ty CP Xây dựng Hòa Bình Xanh', 'NPP Hoàng Phát', 'Điện máy Tân Thịnh', 'Công ty TNHH Kỹ thuật Nam Việt', 'Cơ điện Trường Sơn'];
const REPS = ['Trần Quốc Bảo', 'Lê Thu Hà', 'Phạm Minh Đức', 'Nguyễn Hoài Nam'];
const STS: DemoSt[] = ['PENDING', 'APPROVED', 'SHIPPING', 'DONE', 'DONE', 'DONE', 'CANCELLED'];

/** Dữ liệu mẫu cố định (không ngẫu nhiên) để ảnh chụp kiểm tra luôn giống nhau */
const DEMO: Demo[] = Array.from({ length: 26 }, (_, i) => {
  const net = 4_800_000 + ((i * 7_919_000) % 92_000_000);
  const st = STS[i % STS.length];
  return {
    id: `d${i}`, code: `DH-2611-${String(40 - i).padStart(3, '0')}`, date: `2026-11-${String(26 - (i % 25)).padStart(2, '0')}`,
    customer: CUS[i % CUS.length], rep: REPS[i % REPS.length], status: st, net, vat: Math.round(net * 0.08),
    paid: st === 'DONE' ? Math.round(net * 1.08) : st === 'SHIPPING' ? Math.round(net * 0.5) : 0,
  };
});

/** Mẫu cho bộ lọc trạng thái 2 lớp (8 trạng thái, có tên rút gọn) */
type DemoSo = 'APPROVAL' | 'APPROVED' | 'WAIT' | 'SHIP' | 'UNPAID' | 'PAID' | 'DONE' | 'CANCELLED';
const SO_DEMO: StatusOpt<DemoSo>[] = [
  { value: 'APPROVAL', label: 'Chờ duyệt', count: 4 }, { value: 'APPROVED', label: 'Đã duyệt', count: 6 }, { value: 'WAIT', label: 'Chờ xuất kho', count: 3 },
  { value: 'SHIP', label: 'Đang giao hàng', short: 'Đang giao', count: 5 }, { value: 'UNPAID', label: 'Chưa thanh toán', short: 'Chưa thu', count: 9 },
  { value: 'PAID', label: 'Đã thanh toán', short: 'Đã thu', count: 21 }, { value: 'DONE', label: 'Hoàn thành', count: 18 }, { value: 'CANCELLED', label: 'Đã hủy', count: 2 },
];

const n = (v: number) => new Intl.NumberFormat('vi-VN').format(Math.round(v));
const d = (iso: string) => iso.split('-').reverse().join('/');

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[15px] font-medium">{title}</h2>
        {sub && <p className="text-[12.5px] text-[rgb(var(--muted))]">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function stepsOf(o: Demo): WorkflowStep[] {
  const at = d(o.date).slice(0, 5);
  const idx = { PENDING: 1, APPROVED: 2, SHIPPING: 3, DONE: 5, CANCELLED: 1 }[o.status];
  const labels: [string, string][] = [['new', 'Tạo đơn'], ['approve', 'Duyệt đơn'], ['issue', 'Xuất kho'], ['pay', 'Thu tiền'], ['inv', 'Hóa đơn']];
  return labels.map(([key, label], i) => ({
    key, label,
    state: o.status === 'CANCELLED' && i === 1 ? 'blocked' : i < idx ? 'done' : i === idx ? 'current' : 'todo',
    at: i < idx ? at : undefined,
  }));
}

export function ConsoleUiKit() {
  const [q, setQ] = useState('');
  const [st, setSt] = useState<DemoSt | 'ALL'>('ALL');
  const [rep, setRep] = useState('ALL');
  const [open, setOpen] = useState<Demo | null>(null);
  const [emptyDemo, setEmptyDemo] = useState(false);
  const [so, setSo] = useState<DemoSo | 'ALL'>('ALL');
  const [soM, setSoM] = useState<DemoSo[]>([]);
  const rows = useMemo(() => (emptyDemo ? [] : DEMO.filter((o) => (st === 'ALL' || o.status === st) && (rep === 'ALL' || o.rep === rep) && (!q.trim() || `${o.code} ${o.customer}`.toLowerCase().includes(q.trim().toLowerCase())))), [q, st, rep, emptyDemo]);
  const active: ActiveFilter[] = [
    ...(st !== 'ALL' ? [{ key: 'st', label: `Trạng thái: ${ST[st].label}`, onClear: () => setSt('ALL') }] : []),
    ...(rep !== 'ALL' ? [{ key: 'rep', label: `Phụ trách: ${rep}`, onClear: () => setRep('ALL') }] : []),
  ];
  const sum = (f: (o: Demo) => number) => rows.reduce((a, o) => a + f(o), 0);
  const cols: DataCol<Demo>[] = [
    { key: 'code', label: 'Mã đơn', render: (o) => <span className="code-chip">{o.code}</span>, sort: (o) => o.code },
    { key: 'date', label: 'Ngày', render: (o) => <span className="tabular-nums">{d(o.date)}</span>, sort: (o) => o.date },
    { key: 'cus', label: 'Khách hàng', render: (o) => <span className="block max-w-[240px] truncate">{o.customer}</span>, title: (o) => o.customer, sort: (o) => o.customer },
    { key: 'rep', label: 'Phụ trách', render: (o) => o.rep, sort: (o) => o.rep, className: 'text-[rgb(var(--fg2))]' },
    { key: 'st', label: 'Trạng thái', render: (o) => <StatusBadge tone={ST[o.status].tone} size="sm">{ST[o.status].label}</StatusBadge>, sort: (o) => o.status },
    { key: 'net', label: 'Doanh số', numeric: true, render: (o) => n(o.net), sort: (o) => o.net },
    { key: 'vat', label: 'VAT', numeric: true, optional: true, render: (o) => n(o.vat), sort: (o) => o.vat },
    { key: 'total', label: 'Tổng đơn', numeric: true, render: (o) => n(o.net + o.vat), sort: (o) => o.net + o.vat },
    { key: 'due', label: 'Còn nợ', numeric: true, render: (o) => { const v = o.status === 'CANCELLED' ? 0 : o.net + o.vat - o.paid; return <span className={cn(v > 0 && 'text-[rgb(var(--accent-fg))]')}>{n(v)}</span>; }, sort: (o) => o.net + o.vat - o.paid },
  ];
  return (
    <div className="space-y-8" data-uikit>
      <PageHeader
        crumbs={[{ label: '3A Platform' }, { label: 'Bộ giao diện' }]}
        title="Bộ giao diện lõi"
        meta={<StatusBadge tone="info" size="sm">v59</StatusBadge>}
        sub="Mẫu trưng bày bằng dữ liệu giả lập. Đổi Sáng / Tối ở thanh trên để kiểm tra độ tương phản."
        secondary={[{ label: 'Xuất Excel', icon: Download, onClick: () => undefined }, { label: 'Nhập từ file', icon: Upload, onClick: () => undefined }]}
        primary={{ label: 'Lên đơn bán', icon: Plus, onClick: () => setOpen(DEMO[0]) }}
      />

      <Section title="StatKpiCard" sub="Dùng ở Tổng quan / báo cáo; không đặt trên đầu trang danh sách (v49)">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatKpiCard label="Doanh thu tháng 11" value="1,28 tỷ" icon={Wallet} delta={12.4} />
          <StatKpiCard label="Đơn bán mới" value="64" unit="đơn" icon={ShoppingBag} delta={8} />
          <StatKpiCard label="Công nợ quá hạn" value="182 tr" icon={AlertTriangle} delta={-6.2} lowerIsBetter tone="danger" />
          <StatKpiCard label="Giao đúng hẹn" value="94,1" unit="%" icon={Truck} delta={0} deltaLabel="giữ như tháng 10" />
        </div>
      </Section>

      <Section title="SmartDataTable" sub="Mỗi trường 1 cột · mỗi ô 1 dòng · chọn cột · lọc bằng nút phễu · dòng tổng · bấm dòng mở bảng trượt">
        <SmartDataTable<Demo>
          id="uikit-orders" title="Danh sách đơn mẫu" unit="đơn" rows={rows} columns={cols} rowKey={(o) => o.id} onRowClick={setOpen} pageSize={10}
          search={{ value: q, onChange: setQ, placeholder: 'Tìm mã đơn, khách hàng' }}
          filter={{
            count: active.length, active, onReset: () => { setSt('ALL'); setRep('ALL'); },
            panel: (
              <>
                <Field label="Trạng thái">
                  <select className={inputCls} value={st} onChange={(e) => setSt(e.target.value as DemoSt | 'ALL')}>
                    <option value="ALL">Tất cả trạng thái</option>
                    {(Object.keys(ST) as DemoSt[]).map((k) => <option key={k} value={k}>{ST[k].label}</option>)}
                  </select>
                </Field>
                <Field label="Nhân viên phụ trách">
                  <select className={inputCls} value={rep} onChange={(e) => setRep(e.target.value)}>
                    <option value="ALL">Tất cả nhân viên</option>
                    {REPS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
              </>
            ),
          }}
          toolbar={<button type="button" className={cn(btnGhost, 'h-8 py-0 text-[13px]')} onClick={() => setEmptyDemo((v) => !v)} aria-pressed={emptyDemo}>{emptyDemo ? 'Hiện dữ liệu' : 'Xem khi trống'}</button>}
          totals={{ code: 'Tổng', net: n(sum((o) => o.net)), vat: n(sum((o) => o.vat)), total: n(sum((o) => o.net + o.vat)), due: n(sum((o) => (o.status === 'CANCELLED' ? 0 : o.net + o.vat - o.paid))) }}
          empty={emptyDemo ? <EmptyState art="inbox" text="Chưa có đơn bán trong tháng này" hint="Đơn mới tạo ở Bán hàng hoặc nhập từ file Excel sẽ hiện ở đây." steps={['Bấm "Lên đơn bán" và chọn khách hàng', 'Thêm hàng hóa, kiểm tra giá và chiết khấu', 'Gửi duyệt hoặc tự duyệt khi trong ngưỡng']} action="Lên đơn bán" onAction={() => setOpen(DEMO[0])} secondary={{ label: 'Nhập từ file', icon: Upload, onClick: () => undefined }} /> : undefined}
        />
      </Section>

      <Section title="StatusBar — lọc trạng thái 2 lớp" sub="Tất cả luôn đầu + tối đa 5 trạng thái chính (nút bo tròn, không chấm màu) · thừa vào Thêm ▾ trên desktop, cuộn ngang trên mobile · phễu chọn nhiều, chọn trong phễu hiện thẻ ×">
        <div className={cn(kCard, 'space-y-2 p-4')}>
          <StatusBar<DemoSo> options={SO_DEMO} value={so} onChange={setSo} multi={soM} onMulti={setSoM} total={SO_DEMO.reduce((a, o) => a + (o.count ?? 0), 0)} label="Trạng thái đơn" funnel />
          <p className="text-[12.5px] text-[rgb(var(--muted))]" aria-live="polite">Đang lọc: {soM.length ? soM.map((v) => SO_DEMO.find((o) => o.value === v)?.label).join(', ') : so === 'ALL' ? 'Tất cả' : SO_DEMO.find((o) => o.value === so)?.label}</p>
        </div>
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="StatusBadge" sub="Nền pastel 12–14%, chữ cùng tông; luôn có chữ, không chỉ dựa vào màu">
          <div className={cn(kCard, 'space-y-3 p-5')}>
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="neutral">Nháp</StatusBadge>
              <StatusBadge tone="info">Đã duyệt</StatusBadge>
              <StatusBadge tone="accent" dot>Chờ duyệt</StatusBadge>
              <StatusBadge tone="warning">Giao một phần</StatusBadge>
              <StatusBadge tone="success" icon={CheckCircle2}>Hoàn thành</StatusBadge>
              <StatusBadge tone="danger">Quá hạn 3 ngày</StatusBadge>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['neutral', 'info', 'accent', 'warning', 'success', 'danger'] as StatusTone[]).map((t) => <StatusBadge key={t} tone={t} size="sm">{t}</StatusBadge>)}
            </div>
          </div>
        </Section>
        <Section title="WorkflowStepper" sub="Ngang cho đầu chi tiết / bảng trượt, dọc cho cột phải">
          <div className={cn(kCard, 'space-y-6 p-5')}>
            <WorkflowStepper steps={stepsOf(DEMO[2])} />
            <WorkflowStepper steps={[
              { key: 'a', label: 'Tạo đơn', at: '25/11 22:29', sub: 'Trần Quốc Bảo', state: 'done' },
              { key: 'b', label: 'Duyệt đơn', at: '25/11 22:31', sub: 'Giám đốc', state: 'done' },
              { key: 'c', label: 'Xuất kho', sub: 'Kho Tổng Hà Nội · chờ thủ kho duyệt', state: 'current' },
              { key: 'd', label: 'Hóa đơn', sub: 'Chưa yêu cầu', state: 'todo' },
              { key: 'e', label: 'Lắp đặt', sub: 'Khách tự nhận hàng', state: 'skipped' },
            ]} orientation="vertical" />
          </div>
        </Section>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="EmptyState" sub="Nói rõ vì sao trống + 1 hành động tại chỗ">
          <div className={cn(kCard, 'p-5')}>
            <EmptyState art="ledger" text="Chưa ghi sổ kỳ này" hint="Bút toán tự sinh từ phiếu thu chi, phiếu kho và hóa đơn sau khi bắt đầu ghi sổ." action="Bắt đầu ghi sổ" actionIcon={FileText} onAction={() => undefined} />
          </div>
        </Section>
        <Section title="EmptyState (gọn)" sub="Trong thẻ nhỏ, bảng trượt, cột phải">
          <div className={cn(kCard, 'space-y-2 p-5')}>
            <EmptyState compact icon={Inbox} text="Không có yêu cầu chờ xuất hóa đơn" hint="Yêu cầu mới từ đơn bán sẽ hiện ở đây." />
            <EmptyState compact icon={Users} text="Chưa có người liên quan" secondary={{ label: 'Thêm người theo dõi', icon: Plus, onClick: () => undefined }} />
          </div>
        </Section>
      </div>

      <Section title="Token" sub="Đọc trong THEME_CSS; màu giữ nguyên hệ v26 / v40">
        <div className={cn(kCard, 'grid gap-6 p-5 md:grid-cols-3')}>
          <div>
            <p className="mb-2 text-[12.5px] text-[rgb(var(--muted))]">Khoảng cách (lưới 4px)</p>
            <ul className="space-y-1.5">
              {[1, 2, 3, 4, 5, 6, 8, 10].map((s) => (
                <li key={s} className="flex items-center gap-3 text-[12.5px] tabular-nums"><span className="w-20 font-mono text-[rgb(var(--fg2))]">--space-{s}</span><span className="h-2 rounded-sm bg-[rgb(var(--secondary)/0.5)]" style={{ width: `var(--space-${s})` }} /><span className="text-[rgb(var(--muted))]">{s * 4}px</span></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[12.5px] text-[rgb(var(--muted))]">Bo góc · viền · bóng</p>
            <div className="flex flex-wrap gap-3">
              {[['badge', 'var(--radius-badge)'], ['nút / ô', '8px'], ['thẻ', '12px'], ['sheet', 'var(--radius-xl)']].map(([l, r]) => (
                <div key={l} className="grid h-16 w-20 place-items-center border border-[rgb(var(--border))] bg-[rgb(var(--raised))] text-[11.5px] text-[rgb(var(--fg2))]" style={{ borderRadius: r }}>{l}</div>
              ))}
              <div className="grid h-16 w-20 place-items-center rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[11.5px] text-[rgb(var(--fg2))] shadow-[var(--shadow-pop)]">popover</div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-[12.5px] text-[rgb(var(--muted))]">Chữ</p>
            <ul className="space-y-1">
              <li className="font-archivo text-[20px] font-semibold leading-7">Tiêu đề trang 20</li>
              <li className="text-[17px] font-semibold">Tiêu đề bảng trượt 17</li>
              <li className="text-[15px] font-medium">Tiêu đề khối 15</li>
              <li className="text-[13.5px]">Chữ bảng 13,5 · <span className="font-mono tabular-nums">1.234.567</span></li>
              <li className="text-[12.5px] text-[rgb(var(--muted))]">Nhãn 12,5</li>
            </ul>
          </div>
        </div>
      </Section>

      {open && (
        <SlideOverDrawer size="lg" title={`Duyệt đơn · ${open.code}`} eyebrow={open.customer} badge={<StatusBadge tone={ST[open.status].tone} size="sm">{ST[open.status].label}</StatusBadge>}
          description="Kiểm tra giá, tồn kho và hạn mức công nợ trước khi duyệt."
          actions={<><button type="button" className={cn(btnGhost, 'py-1.5 text-[13px]')}><Printer className="h-4 w-4" aria-hidden />In phiếu</button><button type="button" className={cn(btnGhost, 'py-1.5 text-[13px]')}><Banknote className="h-4 w-4" aria-hidden />Lịch sử thu</button></>}
          onClose={() => setOpen(null)}
          footerNote={<>Tổng đơn <b className="font-medium text-[rgb(var(--fg))]">{n(open.net + open.vat)}</b></>}
          secondaryActions={[{ label: 'Trả lại', icon: RotateCcw, onClick: () => setOpen(null) }]}
          primaryAction={{ label: 'Duyệt đơn', icon: CheckCircle2, onClick: () => setOpen(null) }}>
          <WorkflowStepper steps={stepsOf(open)} />
          <div className="grid gap-4 sm:grid-cols-3">
            {[['Doanh số', n(open.net)], ['VAT 8%', n(open.vat)], ['Đã thu', n(open.paid)]].map(([l, v]) => (
              <div key={l} className={cn(kCard, 'p-4')}><p className="text-[12.5px] text-[rgb(var(--muted))]">{l}</p><p className="mt-1 text-[17px] font-medium tabular-nums">{v}</p></div>
            ))}
          </div>
          <div className="space-y-2 text-[13.5px]">
            {[['Khách hàng', open.customer], ['Ngày đơn', d(open.date)], ['Phụ trách', open.rep], ['Kho xuất', 'Kho Tổng Hà Nội']].map(([l, v]) => (
              <div key={l} className="flex justify-between gap-4 border-b border-[rgb(var(--border))] pb-2 last:border-0"><span className="text-[rgb(var(--muted))]">{l}</span><span className="text-right">{v}</span></div>
            ))}
          </div>
          <EmptyState compact icon={Inbox} text="Chưa có trao đổi về đơn này" />
        </SlideOverDrawer>
      )}
    </div>
  );
}
