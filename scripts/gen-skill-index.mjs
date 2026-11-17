#!/usr/bin/env node
/**
 * Quét lib/ai/skills/<id>/skill.ts và sinh lib/ai/skills/_generated.ts.
 * Chạy tự động trước build/dev:  "predev": "node scripts/gen-skill-index.mjs", "prebuild": "node scripts/gen-skill-index.mjs"
 * => Thêm Skill = tạo thư mục mới; gỡ Skill = xóa thư mục (hoặc đặt enabled: false). Không sửa file lõi nào.
 * Thư mục bắt đầu bằng "_" (VD _template) được bỏ qua.
 */
import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Tìm thư mục skills: src/lib/ai/skills (dự án có src/) hoặc lib/ai/skills, tính từ thư mục gốc dự án (cha của scripts/)
const base = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = [join(base, 'src', 'lib', 'ai', 'skills'), join(base, 'lib', 'ai', 'skills')].find((p) => existsSync(p));
if (!root) { console.error('[skills] không tìm thấy src/lib/ai/skills hoặc lib/ai/skills'); process.exit(1); }
const ids = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_') && existsSync(join(root, d.name, 'skill.ts')))
  .map((d) => d.name)
  .sort();

const out = `// FILE SINH TỰ ĐỘNG bởi scripts/gen-skill-index.mjs — không sửa tay
import type { SkillManifest } from '../core/types';
${ids.map((id, i) => `import s${i} from './${id}/skill';`).join('\n')}

export const SKILLS: readonly SkillManifest[] = [${ids.map((_, i) => `s${i}`).join(', ')}];
`;
writeFileSync(join(root, '_generated.ts'), out);
console.log(`[skills] ${ids.length} skill: ${ids.join(', ')}`);
