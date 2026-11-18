import type { JsonSchema } from './types';

/**
 * Kiểm tra tham số LLM gửi cho tool theo đúng JSON Schema đã khai báo.
 * LLM có thể gửi sai kiểu / thiếu trường / thêm trường lạ: chặn ở đây trước khi chạm DB.
 * Trả về đối tượng đã làm sạch (bỏ trường không khai báo) hoặc danh sách lỗi để báo lại cho LLM tự sửa.
 */
export function validateInput(schema: JsonSchema, value: unknown, path = 'input'): { ok: true; value: any } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const out = walk(schema, value, path, errors);
  return errors.length ? { ok: false, errors } : { ok: true, value: out };
}

function walk(s: JsonSchema, v: unknown, p: string, errs: string[]): unknown {
  switch (s.type) {
    case 'object': {
      if (v === undefined || v === null) v = {};
      if (typeof v !== 'object' || Array.isArray(v)) { errs.push(`${p}: cần object`); return undefined; }
      const o = v as Record<string, unknown>;
      const res: Record<string, unknown> = {};
      for (const k of s.required ?? []) if (o[k] === undefined || o[k] === null || o[k] === '') errs.push(`${p}.${k}: bắt buộc`);
      for (const [k, sub] of Object.entries(s.properties)) if (o[k] !== undefined && o[k] !== null) res[k] = walk(sub, o[k], `${p}.${k}`, errs);
      return res;
    }
    case 'string': {
      if (typeof v !== 'string') { errs.push(`${p}: cần chuỗi`); return undefined; }
      if (s.enum && !s.enum.includes(v)) errs.push(`${p}: phải là một trong ${s.enum.join(', ')}`);
      if (s.maxLength && v.length > s.maxLength) errs.push(`${p}: tối đa ${s.maxLength} ký tự`);
      if (s.format === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errs.push(`${p}: định dạng YYYY-MM-DD`);
      if (s.format === 'date-time' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) errs.push(`${p}: định dạng YYYY-MM-DDTHH:mm`);
      return v;
    }
    case 'integer':
    case 'number': {
      const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
      if (typeof n !== 'number' || !Number.isFinite(n) || (s.type === 'integer' && !Number.isInteger(n))) { errs.push(`${p}: cần ${s.type === 'integer' ? 'số nguyên' : 'số'}`); return undefined; }
      if (s.minimum !== undefined && n < s.minimum) errs.push(`${p}: tối thiểu ${s.minimum}`);
      if (s.maximum !== undefined && n > s.maximum) errs.push(`${p}: tối đa ${s.maximum}`);
      return n;
    }
    case 'boolean':
      if (typeof v !== 'boolean') { errs.push(`${p}: cần true/false`); return undefined; }
      return v;
    case 'array': {
      if (!Array.isArray(v)) { errs.push(`${p}: cần mảng`); return undefined; }
      if (s.maxItems && v.length > s.maxItems) errs.push(`${p}: tối đa ${s.maxItems} phần tử`);
      return v.map((x, i) => walk(s.items, x, `${p}[${i}]`, errs));
    }
  }
}

/** Chuyển schema nội bộ sang dạng Gemini chấp nhận (OpenAPI subset, không có format lạ) */
export function toGeminiSchema(s: JsonSchema): Record<string, unknown> {
  switch (s.type) {
    case 'object': return { type: 'OBJECT', properties: Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toGeminiSchema(v)])), ...(s.required?.length ? { required: s.required } : {}), ...(s.description ? { description: s.description } : {}) };
    case 'array': return { type: 'ARRAY', items: toGeminiSchema(s.items), ...(s.description ? { description: s.description } : {}) };
    case 'string': return { type: 'STRING', ...(s.enum ? { enum: [...s.enum] } : {}), ...(s.description ? { description: s.description } : {}) };
    case 'integer': return { type: 'INTEGER', ...(s.description ? { description: s.description } : {}) };
    case 'number': return { type: 'NUMBER', ...(s.description ? { description: s.description } : {}) };
    case 'boolean': return { type: 'BOOLEAN', ...(s.description ? { description: s.description } : {}) };
  }
}
