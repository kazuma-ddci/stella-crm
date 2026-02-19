import { prisma } from "@/lib/prisma";
import type { AssignableFieldCode } from "./assignable-fields";
import type { Prisma } from "@prisma/client";

type StaffOption = { value: string; label: string };

/**
 * 単一フィールドの制約に基づいてスタッフ選択肢を取得
 * 制約が0件の場合は全アクティブスタッフを返す（フォールバック）
 */
export async function getStaffOptionsByField(
  fieldCode: AssignableFieldCode,
): Promise<StaffOption[]> {
  const result = await getStaffOptionsByFields([fieldCode]);
  return result[fieldCode];
}

/**
 * 複数フィールドの制約を1クエリで一括取得してスタッフ選択肢を返す
 */
export async function getStaffOptionsByFields<T extends AssignableFieldCode>(
  fieldCodes: T[],
): Promise<Record<T, StaffOption[]>> {
  // 全制約を一括取得
  const restrictions = await prisma.staffFieldRestriction.findMany({
    where: { fieldCode: { in: fieldCodes } },
  });

  // フィールドごとに制約を分類
  const restrictionsByField = new Map<string, { projectIds: number[]; roleTypeIds: number[] }>();
  for (const r of restrictions) {
    let entry = restrictionsByField.get(r.fieldCode);
    if (!entry) {
      entry = { projectIds: [], roleTypeIds: [] };
      restrictionsByField.set(r.fieldCode, entry);
    }
    if (r.projectId != null) entry.projectIds.push(r.projectId);
    if (r.roleTypeId != null) entry.roleTypeIds.push(r.roleTypeId);
  }

  // ユニークなフィルタ条件を構築（同じ条件は重複クエリしない）
  type FilterKey = string;
  const filterMap = new Map<FilterKey, Prisma.MasterStaffWhereInput>();
  const fieldToFilterKey = new Map<string, FilterKey>();

  for (const code of fieldCodes) {
    const entry = restrictionsByField.get(code);
    if (!entry || (entry.projectIds.length === 0 && entry.roleTypeIds.length === 0)) {
      // 制約なし → 全スタッフ
      const key = "__all__";
      fieldToFilterKey.set(code, key);
      if (!filterMap.has(key)) {
        filterMap.set(key, {});
      }
    } else {
      const pIds = [...entry.projectIds].sort();
      const rIds = [...entry.roleTypeIds].sort();
      const key = `p:${pIds.join(",")}_r:${rIds.join(",")}`;
      fieldToFilterKey.set(code, key);

      if (!filterMap.has(key)) {
        const conditions: Prisma.MasterStaffWhereInput[] = [];
        if (pIds.length > 0) {
          conditions.push({
            projectAssignments: { some: { projectId: { in: pIds } } },
          });
        }
        if (rIds.length > 0) {
          conditions.push({
            roleAssignments: { some: { roleTypeId: { in: rIds } } },
          });
        }
        filterMap.set(key, conditions.length > 1 ? { AND: conditions } : conditions[0]);
      }
    }
  }

  // 各ユニーク条件でスタッフを取得
  const staffByFilterKey = new Map<FilterKey, StaffOption[]>();
  const queries = [...filterMap.entries()].map(async ([key, where]) => {
    const staff = await prisma.masterStaff.findMany({
      where: { isActive: true, isSystemUser: false, ...where },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    });
    staffByFilterKey.set(
      key,
      staff.map((s) => ({ value: String(s.id), label: s.name })),
    );
  });
  await Promise.all(queries);

  // フィールドごとの結果をマッピング
  const result = {} as Record<T, StaffOption[]>;
  for (const code of fieldCodes) {
    const filterKey = fieldToFilterKey.get(code)!;
    result[code] = staffByFilterKey.get(filterKey) || [];
  }
  return result;
}
