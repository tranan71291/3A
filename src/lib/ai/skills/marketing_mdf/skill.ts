import type { SkillManifest } from '../../core/types';
import { MDF_PROMPT } from './prompt';
import { getClaimsDue, getMdfBudget, listMdfPrograms, searchMdfPolicy } from './tools';

/**
 * Skill "Quỹ MDF & Marketing". Toàn bộ nằm trong thư mục này: xóa thư mục = gỡ Skill, không ảnh hưởng Skill khác.
 * Trưởng phòng được xem chương trình / claim của phòng mình nhưng không xem ngân sách tổng (tool get_mdf_budget giới hạn vai trò).
 */
const skill: SkillManifest = {
  id: 'marketing_mdf',
  name: 'Quỹ MDF & Marketing',
  version: '1.0.0',
  roles: ['BOD', 'MKT_LEAD', 'ACCOUNTANT', 'DEPT_HEAD'],
  tenants: ['vassh'],
  intents: {
    description: 'Ngân sách quỹ Hãng 3M (MDF, CS), chương trình, claim hoàn quỹ, quy định chứng từ',
    keywords: ['mdf', 'quy 3m', 'quy hang', 'ngan sach', 'giai ngan', 'claim', 'hoan quy', 'pre-approval', 'pre approval', 'chung tu', 'nghiem thu', 'hoi thao', 'trung bay', 'cs fund'],
    patterns: [/con (bao nhieu|lai).*(quy|ngan sach)/, /(quy|ngan sach).*(con lai|kha dung|so du)/, /claim.*(het han|sap han|qua han)/],
  },
  prompt: MDF_PROMPT,
  tools: [getMdfBudget, listMdfPrograms, getClaimsDue, searchMdfPolicy],
  knowledge: { namespaces: ['mdf_policy', 'vendor_3m'] },
};

export default skill;
