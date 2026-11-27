'use client';

import { createContext, type KeyboardEvent, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useOutsideClose } from '../../app/header';
import { cn } from '../../lib/utils';
import { FilterChips, FilterPopover, type ActiveFilter } from './filter-popover';
import { kPop } from './tokens';

// =====================================================================
//  v59 Lọc trạng thái 2 lớp — dùng chung toàn CRM
//  Lớp 1 (thanh nhanh): [Tất cả] + tối đa 5 trạng thái chính, nút bo tròn, không chấm màu.
//    Desktop: trạng thái còn lại gom vào "Thêm ▾". Mobile: hiện hết, cuộn ngang.
//  Lớp 2 (phễu lọc): danh sách đủ trạng thái, chọn nhiều. Chọn trong phễu thì hiện thẻ tên trạng thái
//    kèm × ở thanh công cụ để bỏ nhanh.
//  Chọn nhanh (1 trạng thái) và chọn trong phễu (nhiều) loại trừ nhau: chọn bên này thì bỏ bên kia.
// =====================================================================

export type StatusOpt<T extends string = string> = {
  value: T;
  /** Tên đầy đủ: hiện trong phễu, Thêm ▾ và chú thích khi rê chuột */
  label: string;
  /** Tên rút gọn cho nút ở thanh nhanh và thẻ đang lọc */
  short?: string;
  count?: number;
  /** Chỉ là lối tắt ở thanh nhanh (vd. "Đang xử lý" gồm nhiều trạng thái), không nằm trong phễu */
  quickOnly?: boolean;
};

export type StatusFilterProps<T extends string> = {
  options: StatusOpt<T>[];
  /** Chọn nhanh: 1 trạng thái hoặc 'ALL' */
  value: T | 'ALL';
  onChange: (v: T | 'ALL') => void;
  /** Chọn trong phễu: nhiều trạng thái ([] = không lọc) */
  multi?: readonly T[];
  onMulti?: (v: T[]) => void;
  /** Tên bộ lọc: Trạng thái, Loại yêu cầu, Danh mục… */
  label?: string;
  allLabel?: string;
  /** Số đếm của "Tất cả" */
  total?: number;
  /** Số trạng thái chính hiện ngoài thanh (mặc định 5), hoặc danh sách cụ thể */
  main?: number | readonly T[];
  /** Bấm lại nút đang chọn thì về Tất cả (mặc định tắt: về "Tất cả" bằng nút đầu hàng, như chọn tab) */
  toggle?: boolean;
  /** Danh sách trong phễu chia 2 cột (bảng phễu rộng) */
  columns?: 1 | 2;
  /** Đứng riêng (không trong thanh lọc có phễu): tự có nút phễu khi có trạng thái thừa ('auto'), luôn có (true) hoặc không (false) */
  funnel?: 'auto' | boolean;
};

/** Thanh lọc có phễu (FilterBar…) báo cho bộ lọc trạng thái biết nó đang ở thanh công cụ hay trong bảng phễu */
export const StatusScope = createContext<null | { mode: 'bar' | 'panel'; register?: (key: string, n: number, clear: () => void) => void }>(null);

/** Điều kiện lọc: có chọn trong phễu thì khớp 1 trong các trạng thái đó; không thì theo chọn nhanh */
export function stMatch<T extends string>(value: T | 'ALL', multi: readonly T[] | undefined, test: (s: T) => boolean): boolean {
  if (multi && multi.length) return multi.some(test);
  return value === 'ALL' || test(value as T);
}

/** Trạng thái đang lọc thực tế (dùng cho ô tích trong phễu) */
export function stEffective<T extends string>(value: T | 'ALL', multi: readonly T[] | undefined, options: StatusOpt<T>[]): T[] {
  if (multi && multi.length) return [...multi];
  return value !== 'ALL' && options.some((o) => o.value === value && !o.quickOnly) ? [value as T] : [];
}

const pill = 'inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] leading-none transition-[background-color,color,border-color] duration-[var(--dur-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--fg)/0.6)]';
const pillOn = 'border-[rgb(var(--fg))] bg-[rgb(var(--fg))] font-medium text-[rgb(var(--bg))]';
const pillOff = 'border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/var(--hover-a))] hover:text-[rgb(var(--fg))]';
const cnt = (on: boolean) => cn('text-[12px] font-normal tabular-nums', on ? 'text-[rgb(var(--bg)/0.72)]' : 'text-[rgb(var(--muted))]');
const nameOf = <T extends string>(o: StatusOpt<T>) => o.short || o.label;

function splitMain<T extends string>(opts: StatusOpt<T>[], main: StatusFilterProps<T>['main']): [StatusOpt<T>[], StatusOpt<T>[]] {
  if (Array.isArray(main)) return [opts.filter((o) => main.includes(o.value)), opts.filter((o) => !main.includes(o.value))];
  const n = typeof main === 'number' ? main : 5;
  // không để "Thêm ▾" chỉ có 1 mục: 6 trạng thái thì 4 chính + 2 trong Thêm
  const k = main === undefined && opts.length === n + 1 ? n - 1 : n;
  return [opts.slice(0, k), opts.slice(k)];
}

/** Danh sách đủ trạng thái trong phễu, chọn nhiều (không có onMulti thì chọn 1) */
export function StatusChecklist<T extends string>({ options, value, onChange, multi, onMulti, label = 'Trạng thái', columns = 1 }: StatusFilterProps<T>) {
  const list = options.filter((o) => !o.quickOnly);
  const eff = stEffective(value, multi, options);
  const set = (next: T[]) => {
    if (!onMulti) { onChange(next[next.length - 1] ?? 'ALL'); return; }
    onMulti(next);
    if (value !== 'ALL') onChange('ALL');
  };
  const toggle = (v: T) => set(eff.includes(v) ? eff.filter((x) => x !== v) : list.map((o) => o.value).filter((x) => x === v || (onMulti ? eff.includes(x) : false)));
  return (
    <fieldset data-status-checklist className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <legend className="text-xs font-medium text-[rgb(var(--muted))]">{label}</legend>
        {eff.length > 0 && <button type="button" className="text-[12px] text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => set([])}>Bỏ chọn</button>}
      </div>
      <div className={cn('-mx-2 max-h-64 overflow-y-auto', columns === 2 && 'sm:grid sm:grid-cols-2 sm:gap-x-2')}>
        {list.map((o) => (
          <label key={o.value} className="flex h-8 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-[13.5px] text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/var(--hover-a))] hover:text-[rgb(var(--fg))]">
            <input type={onMulti ? 'checkbox' : 'radio'} name={onMulti ? undefined : `st-${label}`} className="h-4 w-4 shrink-0 accent-[rgb(var(--fg))]" checked={eff.includes(o.value)} onChange={() => toggle(o.value)} />
            <span className="min-w-0 flex-1 truncate" title={o.label}>{o.label}</span>
            {o.count !== undefined && <span className="shrink-0 text-[12px] tabular-nums text-[rgb(var(--muted))]">{o.count}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** "Thêm ▾": các trạng thái không phải chính (chỉ desktop) */
function MoreMenu<T extends string>({ items, value, onPick, label }: { items: StatusOpt<T>[]; value: T | 'ALL' | null; onPick: (v: T) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const cur = items.find((o) => o.value === value);
  useEffect(() => { if (open) (menu.current?.querySelector<HTMLElement>('[aria-checked="true"]') ?? menu.current?.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true }); }, [open]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); btn.current?.focus(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const bs = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const i = bs.indexOf(document.activeElement as HTMLButtonElement);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? bs.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length;
    bs[j]?.focus();
  };
  return (
    <div ref={ref} className="relative hidden shrink-0 lg:block">
      <button ref={btn} type="button" data-status-more aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        aria-label={cur ? `Thêm ${label.toLowerCase()}, đang chọn ${cur.label}` : `Thêm ${label.toLowerCase()}`} title={cur?.label}
        className={cn(pill, 'pr-2', cur ? pillOn : pillOff)}>
        {cur ? <><span className="max-w-[160px] truncate">{nameOf(cur)}</span>{cur.count !== undefined && <span className={cnt(true)}>{cur.count}</span>}</> : 'Thêm'}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-[var(--dur-fast)]', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div ref={menu} role="menu" aria-label={`Thêm ${label.toLowerCase()}`} onKeyDown={onKey} data-status-menu
          className={cn(kPop, 'absolute left-0 top-full z-40 mt-1.5 w-60 max-w-[calc(100vw-2rem)] p-1.5 motion-safe:animate-[popIn_.15s_ease-out]')}>
          {items.map((o) => {
            const on = o.value === value;
            return (
              <button key={o.value} type="button" role="menuitemradio" aria-checked={on} onClick={() => { onPick(o.value); setOpen(false); btn.current?.focus(); }}
                className={cn('flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13.5px] outline-none focus-visible:bg-[rgb(var(--ink)/0.06)]', on ? 'font-medium text-[rgb(var(--fg))]' : 'text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/var(--hover-a))] hover:text-[rgb(var(--fg))]')}>
                <span className="grid h-4 w-4 shrink-0 place-items-center" aria-hidden>{on && <Check className="h-3.5 w-3.5" />}</span>
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.count !== undefined && <span className="shrink-0 text-[12px] tabular-nums text-[rgb(var(--muted))]">{o.count}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Bộ lọc trạng thái 2 lớp. Trong FilterBar (truyền qua `chips`): thanh nhanh nằm ở hàng công cụ, danh sách đủ nằm trong phễu
 * của FilterBar. Đứng riêng: tự có nút phễu khi có trạng thái thừa.
 */
export function StatusBar<T extends string>(p: StatusFilterProps<T>) {
  const { options, value, onChange, multi, onMulti, label = 'Trạng thái', allLabel = 'Tất cả', total, main, toggle = false, funnel = 'auto' } = p;
  const scope = useContext(StatusScope);
  const key = useId();
  const n = multi?.length ?? 0;
  const clear = useRef(() => {});
  clear.current = () => onMulti?.([]);
  const reg = scope?.mode === 'bar' ? scope.register : undefined;
  useEffect(() => { reg?.(key, n, () => clear.current()); }, [reg, key, n]);
  useEffect(() => () => reg?.(key, 0, () => {}), [reg, key]);
  // Desktop: hàng không đủ chỗ thì nút chính cuối cùng chuyển dần vào "Thêm ▾" (không để nút bị cắt / cuộn ngang).
  // Đổi cỡ cửa sổ hoặc số thẻ đang lọc thì tính lại từ đầu.
  const grp = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [cap, setCap] = useState(99);
  const [tick, setTick] = useState(0);
  const sig = useRef('');
  const [mainAll, extraAll] = splitMain(options, main);
  const k = Math.min(cap, mainAll.length);
  const nTags = n > 2 ? 1 : n;
  useLayoutEffect(() => {
    const g = grp.current;
    if (!g || scope?.mode === 'panel' || !window.matchMedia('(min-width: 1024px)').matches) return;
    // đổi cỡ cửa sổ / số thẻ / số trạng thái: tính lại từ đầu (đặt lại trong cùng hiệu ứng để không bị lượt khác ghi đè)
    const s = `${tick}|${nTags}|${options.length}`;
    if (sig.current !== s) { sig.current = s; if (cap !== 99) { setCap(99); return; } }
    // thẻ đang lọc bị đẩy xuống dòng dưới: nhường chỗ bằng cách gom bớt nút chính (giữ tối thiểu 2) để thanh công cụ còn 1 dòng
    const tg = root.current?.querySelector<HTMLElement>('[data-filter-tag]');
    const wrapped = !!tg && tg.getBoundingClientRect().top >= g.getBoundingClientRect().bottom - 6;
    if ((g.scrollWidth > g.clientWidth + 1 && k > 0) || (wrapped && k > 2)) setCap(k - 1);
  });
  useEffect(() => {
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setTick((t) => t + 1)); };
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('resize', on); cancelAnimationFrame(raf); };
  }, []);
  if (scope?.mode === 'panel') return <StatusChecklist {...p} />;

  const mainOpts = mainAll.slice(0, k);
  const extra = [...mainAll.slice(k), ...extraAll];
  const multiOn = n > 0;
  const quick = multiOn ? null : value;
  const pick = (v: T | 'ALL') => {
    if (multiOn) onMulti?.([]);
    onChange(toggle && !multiOn && v !== 'ALL' && value === v ? 'ALL' : v);
  };
  const btn = (o: StatusOpt<T> | null, extraCls?: string) => {
    const v = (o ? o.value : 'ALL') as T | 'ALL';
    const on = quick === v;
    const name = o ? nameOf(o) : allLabel;
    const c = o ? o.count : total;
    return (
      <button key={v} type="button" aria-pressed={on} data-status-pill={v} onClick={() => pick(v)} title={o && o.short && o.short !== o.label ? o.label : undefined}
        className={cn(pill, on ? pillOn : pillOff, extraCls)}>
        <span className="max-w-[160px] truncate">{name}</span>{c !== undefined && <span className={cnt(on)}>{c}</span>}
      </button>
    );
  };
  const chosen = multiOn ? options.filter((o) => multi!.includes(o.value)) : [];
  const tags: ActiveFilter[] = chosen.length <= 2
    ? chosen.map((o) => ({ key: `st-${o.value}`, label: nameOf(o), title: o.label, onClear: () => onMulti?.(multi!.filter((x) => x !== o.value)) }))
    : [{ key: 'st-many', label: `${chosen.length} ${label.toLowerCase()}`, title: chosen.map((o) => o.label).join(', '), onClear: () => onMulti?.([]) }];
  const ownFunnel = !scope && !!onMulti && (funnel === true || (funnel === 'auto' && extra.length > 0));
  return (
    <div ref={root} className="flex min-w-0 flex-wrap items-center gap-2" data-status-bar data-main={k}>
      {ownFunnel && (
        <FilterPopover count={n} onReset={() => onMulti?.([])} width="w-72">
          <StatusChecklist {...p} />
        </FilterPopover>
      )}
      <div className="flex min-w-0 items-center gap-1.5">
        <div ref={grp} role="group" aria-label={`Lọc nhanh: ${label}`} className="-m-1 flex min-w-0 gap-1.5 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {btn(null)}
          {mainOpts.map((o) => btn(o))}
          {extra.map((o) => btn(o, 'lg:hidden'))}
        </div>
        {extra.length > 0 && <MoreMenu items={extra} value={quick} onPick={(v) => pick(v)} label={label} />}
      </div>
      <FilterChips items={tags} />
    </div>
  );
}
