"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import type { AssignableFieldCode } from "@/lib/staff/assignable-fields";

export async function saveFieldRestrictions(
  fieldCode: AssignableFieldCode,
  managingProjectId: number,
  sourceProjectIds: number[],
  roleTypeIds: number[],
) {
  await requireProjectMasterDataEditPermission();

  // fieldCodeからStaffFieldDefinitionのidを取得
  const fieldDef = await prisma.staffFieldDefinition.findUnique({
    where: { fieldCode },
    select: { id: true },
  });
  if (!fieldDef) {
    throw new Error(`フィールド定義が見つかりません: ${fieldCode}`);
  }

  // 既存の制約を全削除して再作成（fieldDefinitionId + managingProjectId で絞り込み）
  await prisma.staffFieldRestriction.deleteMany({
    where: { fieldDefinitionId: fieldDef.id, managingProjectId },
  });

  const data: { fieldDefinitionId: number; managingProjectId: number; sourceProjectId?: number; roleTypeId?: number }[] = [];
  for (const sourceProjectId of sourceProjectIds) {
    data.push({ fieldDefinitionId: fieldDef.id, managingProjectId, sourceProjectId });
  }
  for (const roleTypeId of roleTypeIds) {
    data.push({ fieldDefinitionId: fieldDef.id, managingProjectId, roleTypeId });
  }

  if (data.length > 0) {
    await prisma.staffFieldRestriction.createMany({ data });
  }

  revalidatePath("/staff/field-restrictions");
}
