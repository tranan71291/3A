'use client';

// v57a 3A Studio — cài đặt lưới trang (hàng 8px / cổ điển, khoảng cách giữa khối, lề trang), khoảng cách & khung của khối
// theo thiết bị (máy tính / máy tính bảng / điện thoại), chiều cao theo nội dung, cấu hình khối chuyên ngành.
import { useState } from 'react';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import { Field } from '../../components/ui';
import { inputCls, L_GRID_FINE, L_TOKS, lGridOf, lHasData, lType, useApp } from '../../lib/core';
import { industryProfilesEff } from '../../lib/industry';
import type { CfDef, LBlock, LBlockCfg, LGrid, LSpace, LTok } from '../../lib/types';
import { cn } from '../../lib/utils';
import { CbSeg } from '../finance/cashbook';

type Dev = 'lg' | 'md' | 'sm';
const DEVS: [Dev, string, typeof Monitor][] = [['lg', 'Máy tính', Monitor], ['md', 'Máy tính bảng', Tablet], ['sm', 'Điện thoại', Smartphone]];

function TokSel({ label, value, inherit, onChange }: { label: string; value: LTok | undefined; inherit?: string; onChange: (v: LTok | undefined) => void }) {
  return (
    <Field label={label}>
      <select className={inputCls} aria-label={label} value={value === undefined ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? undefined : (Number(e.target.value) as LTok))}>
        <option value="">{inherit ?? 'Mặc định'}</option>
        {L_TOKS.map((t) => <option key={t} value={t}>{t} px</option>)}
      </select>
    </Field>
  );
}

/** Cài đặt trang (hiện khi chưa chọn khối): lưới, khoảng cách giữa khối, lề trang */
export function LPageGridEditor({ grid, onGrid, onFine, count }: { grid?: LGrid; onGrid: (g: LGrid | undefined) => void; onFine: () => void; count: number }) {
  const G = lGridOf(grid);
  const [ask, setAsk] = useState(false);
  return (
    <div className="space-y-3" data-page-grid>
      <h3 className="font-medium">Cài đặt trang</h3>
      <Field label="Lưới">
        <CbSeg label="Lưới" items={[['classic', 'Cổ điển · hàng 56px'], ['fine', 'Mịn · hàng 8px']]} value={G.fine ? 'fine' : 'classic'} onChange={(v) => { if (v === 'fine' && !G.fine) setAsk(true); else if (v === 'classic' && G.fine) onGrid({ ...(grid ?? L_GRID_FINE), row: 56 }); }} />
      </Field>
      {ask && (
        <div className="rounded-lg border border-[rgb(var(--line))] p-3 text-[12.5px]" role="alert">
          <p className="mb-2">Chuyển {count} khối sang lưới 8px: giữ nguyên vị trí và chiều cao trên màn hình, sau đó chỉnh chiều cao từng 8px.</p>
          <div className="flex gap-2"><button type="button" className="rounded-md bg-[rgb(var(--fg))] px-2.5 py-1 text-[rgb(var(--surface))]" onClick={() => { setAsk(false); onFine(); }}>Chuyển sang lưới 8px</button><button type="button" className="rounded-md border border-[rgb(var(--line))] px-2.5 py-1" onClick={() => setAsk(false)}>Thôi</button></div>
        </div>
      )}
      <TokSel label="Khoảng cách giữa khối" value={grid?.gap} inherit={`Mặc định (${G.gap} px)`} onChange={(v) => onGrid({ ...(grid ?? { row: 56, gap: 12 }), gap: v ?? 12 })} />
      <TokSel label="Lề trang" value={grid?.pad} inherit="Không" onChange={(v) => onGrid({ ...(grid ?? { row: 56, gap: 12 }), pad: v })} />
      <p className="text-[12px] text-[rgb(var(--muted))]">{G.fine ? 'Lưới 8px: kéo góc khối để đổi chiều cao từng 8px; Đường kẻ / Khoảng trống có thể thấp 16px.' : 'Lưới cổ điển: mỗi hàng 56px. Chuyển sang lưới 8px để chỉnh khoảng cách giữa các khối mịn hơn.'}</p>
    </div>
  );
}

/** Khoảng cách & khung của khối theo thiết bị (nhóm Kiểu) */
export function LSpacingEditor({ b, onCfg }: { b: LBlock; onCfg: (c: Partial<LBlockCfg>) => void }) {
  const [dev, setDev] = useState<Dev>('lg');
  const base = b.config.sp ?? {};
  const cur: LSpace = dev === 'lg' ? base : b.config.resp?.[dev] ?? {};
  const set = (p: Partial<LSpace>) => {
    const next = Object.fromEntries(Object.entries({ ...cur, ...p }).filter(([, v]) => v !== undefined)) as LSpace;
    if (dev === 'lg') onCfg({ sp: Object.keys(next).length ? next : undefined });
    else { const r = { ...(b.config.resp ?? {}), [dev]: next }; if (!Object.keys(next).length) delete r[dev]; onCfg({ resp: Object.keys(r).length ? r : undefined }); }
  };
  const inh = (k: keyof LSpace) => (dev !== 'lg' && base[k] !== undefined ? `Như máy tính (${base[k]}${k === 'frame' ? '' : ' px'})` : 'Mặc định');
  const frameable = lType(b.type).tier !== 'biz';
  return (
    <div className="space-y-3 border-b border-[rgb(var(--line))] pb-3" data-spacing-editor>
      <div className="flex items-center gap-2"><p className="flex-1 text-[13px] font-medium">Khoảng cách & khung</p>
        <div className="flex rounded-lg border border-[rgb(var(--line))] p-0.5" role="radiogroup" aria-label="Áp dụng cho thiết bị">{DEVS.map(([k, l, I]) => <button key={k} type="button" role="radio" aria-checked={dev === k} aria-label={l} title={l} onClick={() => setDev(k)} className={cn('grid h-6 w-7 place-items-center rounded-md', dev === k ? 'bg-[rgb(var(--fg))] text-[rgb(var(--surface))]' : 'text-[rgb(var(--fg2))]')}><I className="h-3.5 w-3.5" aria-hidden /></button>)}</div>
      </div>
      {dev !== 'lg' && <p className="text-[12px] text-[rgb(var(--muted))]">Ghi đè riêng cho {dev === 'md' ? 'máy tính bảng' : 'điện thoại'}; để Mặc định thì theo máy tính</p>}
      {frameable && (
        <Field label="Khung">
          <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="Khung">
            {([[undefined, dev === 'lg' ? 'Mặc định' : 'Như MT'], ['card', 'Thẻ'], ['outline', 'Viền'], ['flat', 'Phẳng']] as const).map(([v, l]) => <button key={l} type="button" role="radio" aria-checked={cur.frame === v} onClick={() => set({ frame: v })} className={cn('rounded-md border px-1.5 py-1 text-[12px]', cur.frame === v ? 'border-[rgb(var(--fg))] font-medium' : 'border-[rgb(var(--line))] text-[rgb(var(--fg2))]')}>{l}</button>)}
          </div>
        </Field>
      )}
      <div className="grid grid-cols-3 gap-2">
        {frameable && <TokSel label="Đệm trong" value={cur.pad} inherit={inh('pad')} onChange={(v) => set({ pad: v })} />}
        <TokSel label="Cách trên" value={cur.mt} inherit={inh('mt')} onChange={(v) => set({ mt: v })} />
        <TokSel label="Cách dưới" value={cur.mb} inherit={inh('mb')} onChange={(v) => set({ mb: v })} />
      </div>
    </div>
  );
}

/** Thiết bị (nhóm Hiển thị): độ rộng trên máy tính bảng, chiều cao theo nội dung */
export function LDeviceExtra({ b, onCfg, onBlock, fine, dash }: { b: LBlock; onCfg: (c: Partial<LBlockCfg>) => void; onBlock: (p: Partial<LBlock>) => void; fine: boolean; dash: boolean }) {
  const w = b.pos.md?.w;
  return (
    <div className="space-y-3 border-t border-[rgb(var(--line))] pt-3" data-device-extra>
      <Field label="Độ rộng trên máy tính bảng (lưới 6 cột)">
        <select className={inputCls} aria-label="Độ rộng trên máy tính bảng" value={w ? String(w) : ''} onChange={(e) => onBlock({ pos: { ...b.pos, md: e.target.value ? { w: Number(e.target.value) } : undefined } })}>
          <option value="">Tự động (theo máy tính, tối đa 6)</option>
          {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}/6{n === 6 ? ' · cả hàng' : n === 3 ? ' · nửa hàng' : ''}</option>)}
        </select>
      </Field>
      {dash && (
        <label className={cn('flex items-start gap-2 text-[13px]', !fine && 'opacity-60')}>
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--fg))]" checked={!!b.config.autoH} disabled={!fine} onChange={(e) => onCfg({ autoH: e.target.checked || undefined })} />
          <span>Chiều cao theo nội dung<span className="block text-[12px] text-[rgb(var(--muted))]">{fine ? 'Khối tự cao theo nội dung, khối bên dưới tự dời xuống' : 'Cần lưới 8px (Cài đặt trang)'}</span></span>
        </label>
      )}
      {!dash && <p className="text-[12px] text-[rgb(var(--muted))]">Trang nghiệp vụ: chiều cao khối luôn theo nội dung</p>}
    </div>
  );
}

/** Nội dung của khối chuyên ngành (nhóm Nội dung) */
export function LVerticalCfg({ b, onCfg, cf }: { b: LBlock; onCfg: (c: Partial<LBlockCfg>) => void; cf: CfDef[] }) {
  const { platform } = useApp();
  const c = b.config;
  if (b.type === 'K-ResourceCalendar') {
    const kinds = industryProfilesEff(platform.industryProfiles).flatMap((p) => p.resourceKinds).filter((k, i, a) => a.findIndex((x) => x.id === k.id) === i);
    return <>
      <Field label="Số ngày hiện"><CbSeg label="Số ngày hiện" items={[['7', '1 tuần'], ['14', '2 tuần']]} value={String(c.days ?? 7) as '7' | '14'} onChange={(v) => onCfg({ days: Number(v) as 7 | 14 })} /></Field>
      <Field label="Loại tài nguyên"><select className={inputCls} aria-label="Loại tài nguyên" value={c.resKind ?? ''} onChange={(e) => onCfg({ resKind: e.target.value || undefined })}><option value="">Theo trường Chọn tài nguyên của đơn</option>{kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></Field>
    </>;
  }
  if (b.type === 'K-ChecklistTracker') {
    const defs = cf.filter((d) => d.entity === 'sale' && d.scope === 'HEAD' && d.type === 'checklist');
    const on = c.ckKeys ?? [];
    return (
      <Field label="Trường công đoạn hiện (không chọn = mọi trường)">
        <div className="space-y-1">{defs.length ? defs.map((d) => <label key={d.key} className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={on.includes(d.key)} onChange={() => onCfg({ ckKeys: on.includes(d.key) ? on.filter((x) => x !== d.key) : [...on, d.key] })} />{d.label}</label>) : <p className="text-[12px] text-[rgb(var(--muted))]">Chưa có trường kiểu Danh sách công đoạn cho đơn bán</p>}</div>
      </Field>
    );
  }
  if (b.type === 'K-QuickPOS') return <Field label="Số mặt hàng hiện"><CbSeg label="Số mặt hàng hiện" items={[['8', '8'], ['12', '12'], ['16', '16'], ['24', '24']]} value={String(c.posItems ?? 12) as '8' | '12' | '16' | '24'} onChange={(v) => onCfg({ posItems: Number(v) })} /></Field>;
  if (b.type === 'K-WorkflowHeader' || b.type === 'K-StageBoard') return <p className="text-[12px] text-[rgb(var(--muted))]">Các bước lấy từ quy trình của ngành doanh nghiệp (3A sửa ở Ngành & mẫu ngành). Chuyển bước không đổi trạng thái kế toán / kho của đơn</p>;
  return null;
}

export const lIsDash = (b: LBlock) => lHasData(b.type) || lType(b.type).tier === 'show';
