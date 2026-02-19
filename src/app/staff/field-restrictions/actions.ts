"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import type { AssignableFieldCode } from "@/lib/staff/assignable-fields";

export async function saveFieldRestrictions(
  fieldCode: AssignableFieldCode,
  projectIds: number[],
  roleTypeIds: number[],
) {
  await requireMasterDataEditPermission();

  // 既存の制約を全削除して再作成
  await prisma.staffFieldRestriction.deleteMany({
    where: { fieldCode },
  });

  const data: { fieldCode: string; projectId?: number; roleTypeId?: number }[] = [];
  for (const projectId of projectIds) {
    data.push({ fieldCode, projectId });
  }
  for (const roleTypeId of roleTypeIds) {
    data.push({ fieldCode, roleTypeId });
  }

  if (data.length > 0) {
    await prisma.staffFieldRestriction.createMany({ data });
  }

  revalidatePath("/staff/field-restrictions");
}
