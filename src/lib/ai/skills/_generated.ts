// FILE SINH TỰ ĐỘNG bởi scripts/gen-skill-index.mjs — không sửa tay
import type { SkillManifest } from '../core/types';
import s0 from './admin_ops/skill';
import s1 from './alux_production/skill';
import s2 from './marketing_hub/skill';
import s3 from './marketing_mdf/skill';
import s4 from './sales_crm/skill';

export const SKILLS: readonly SkillManifest[] = [s0, s1, s2, s3, s4];
