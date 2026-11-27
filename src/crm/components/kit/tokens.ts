// =====================================================================
//  v59 BỘ GIAO DIỆN LÕI (UI Kit) — lớp Tailwind dùng chung, đọc token trong THEME_CSS
//  Không chứa màu cứng: mọi màu là rgb(var(--token)) để giữ Sáng / Tối và White-label.
// =====================================================================

/** Thẻ chuẩn: nền surface, viền mảnh, bo 12px. Độ nổi chỉ khai báo 1 lần (viền), không thêm bóng. */
export const kCard = 'rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]';

/** Lớp nổi (popover, menu): viền + bóng popover, bo 12px */
export const kPop = 'rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-[var(--shadow-pop)]';

/** Nhãn nhỏ phía trên số / trường */
export const kLabel = 'text-[12.5px] leading-5 text-[rgb(var(--muted))]';

/** Tiêu đề khối (trong thẻ) */
export const kTitle = 'text-[15px] font-medium leading-6 text-[rgb(var(--fg))]';

/** Nút chỉ có biểu tượng: vùng bấm 32px, biểu tượng 16px */
export const kIconBtn = 'relative inline-grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[rgb(var(--ink)/var(--control-a))] bg-[rgb(var(--surface))] text-[rgb(var(--fg2))] transition-[background-color,color,border-color] duration-[var(--dur-fast)] hover:bg-[rgb(var(--ink)/var(--hover-a))] hover:text-[rgb(var(--fg))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--fg)/0.6)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--bg))] disabled:cursor-not-allowed disabled:opacity-40';

/** Số đếm nhỏ gắn trên nút (bộ lọc đang bật…) */
export const kCountBadge = 'pointer-events-none absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[rgb(var(--accent))] px-1 text-[10.5px] font-semibold leading-none text-[rgb(var(--on-accent))] tabular-nums';
