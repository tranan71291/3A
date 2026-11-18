import { insertRecord, listRecords, newId, whoAmI } from '../../core/records';
import type { SkillTool } from '../../core/types';
import { TOOL_SCHEMAS } from '../../tools/schema';

interface Activity { id: string; userId: string; type: string; title: string; from: string; to: string; status: string }

const addMinutes = (local: string, min: number) => {
  // local = YYYY-MM-DDTHH:mm (giờ Việt Nam); cộng phút trên mốc UTC giả định rồi cắt lại cùng định dạng
  const t = Date.parse(`${local.slice(0, 16)}:00Z`) + min * 60_000;
  return new Date(t).toISOString().slice(0, 16);
};

/**
 * add_calendar_event — GHI DỮ LIỆU (mutates: lõi bắt người dùng bấm xác nhận trước khi chạy).
 * Ghi 1 bản ghi coll 'activities' đúng type Activity của app => hiện ngay ở Lịch công tác của người hỏi sau lần đồng bộ.
 * Chỉ tạo lịch cho CHÍNH người hỏi (userId = members.app_user_id), loại không cần duyệt; đi công tác / nghỉ phép không mở qua AI.
 * Kiểm tra trùng giờ với lịch đã có và báo lại (vẫn tạo, AI nhắc người dùng).
 */
export const addCalendarEvent: SkillTool<{ title: string; time: string; duration_minutes?: number; description?: string; location?: string; type?: string }> = {
  name: 'add_calendar_event',
  ...TOOL_SCHEMAS.add_calendar_event,
  async handler({ title, time, duration_minutes, description, location, type }, rt) {
    const { db, ctx, signal } = rt;
    const me = await whoAmI(db, ctx.tenant, signal);
    if (!me.appUserId) return { created: false, error: 'no_app_user', message: 'Tài khoản chưa liên kết hồ sơ nhân sự trong app, chưa tạo được lịch' };
    const from = time.slice(0, 16);
    if (Number.isNaN(Date.parse(`${from}:00Z`))) return { created: false, error: 'invalid_time' };
    const to = addMinutes(from, duration_minutes ?? 60);
    const nowLocal = new Date(ctx.now.getTime() + 7 * 3600_000).toISOString().slice(0, 16);
    if (to < nowLocal) return { created: false, error: 'in_past', message: 'Thời gian đã qua' };

    const mine = await listRecords<Activity>(db, ctx.tenant, 'activities', {
      signal, max: 500,
      filter: (q) => q.eq('data->>userId', me.appUserId!).lt('data->>from', to).gt('data->>to', from),
    });
    const conflicts = mine.filter((a) => !['CANCELLED', 'REJECTED'].includes(a.status)).map((a) => ({ title: a.title, from: a.from, to: a.to }));

    const id = newId('act-ai');
    await insertRecord(db, ctx.tenant, 'activities', id, {
      id, userId: me.appUserId, type: type ?? 'MEETING', title: title.trim(), from, to,
      location: location?.trim() ?? '', cost: 0, note: description?.trim() ?? '', status: 'PLANNED', submittedAt: undefined,
    }, signal);
    return { created: true, id, title, from, to, conflicts, note: conflicts.length ? 'Trùng giờ với lịch đã có, nhắc người dùng.' : undefined };
  },
};
