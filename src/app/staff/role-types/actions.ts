"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function addRoleType(data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  // 最大の表示順を取得して+1
  const maxOrder = await prisma.staffRoleType.aggregate({
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  // codeは自動生成（ROLE-連番）
  const maxId = await prisma.staffRoleType.aggregate({
    _max: { id: true },
  });
  const nextNum = (maxId._max.id ?? 0) + 1;
  const code = `ROLE-${String(nextNum).padStart(3, "0")}`;

  await prisma.staffRoleType.create({
    data: {
      code,
      name: data.name as string,
      description: (data.description as string) || null,
      displayOrder,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/staff/role-types");
  revalidatePath("/staff");
}

export async function updateRoleType(id: number, data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  await prisma.staffRoleType.update({
    where: { id },
    data: {
      name: data.name as string,
      description: (data.description as string) || null,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/staff/role-types");
  revalidatePath("/staff");
}

export async function deleteRoleType(id: number) {
  await requireMasterDataEditPermission();
  await prisma.staffRoleType.delete({
    where: { id },
  });
  revalidatePath("/staff/role-types");
  revalidatePath("/staff");
}

export async function reorderRoleTypes(orderedIds: number[]) {
  await requireMasterDataEditPermission();
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.staffRoleType.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );
  revalidatePath("/staff/role-types");
  revalidatePath("/staff");
}
