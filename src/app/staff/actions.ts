"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function addStaff(data: Record<string, unknown>) {
  const roleTypeIds = (data.roleTypeIds as string[]) || [];
  const projectIds = (data.projectIds as string[]) || [];

  const staff = await prisma.masterStaff.create({
    data: {
      name: data.name as string,
      nameKana: (data.nameKana as string) || null,
      email: (data.email as string) || null,
      phone: (data.phone as string) || null,
      contractType: (data.contractType as string) || null,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });

  // 役割を割り当て
  if (roleTypeIds.length > 0) {
    await prisma.staffRoleAssignment.createMany({
      data: roleTypeIds.map((roleTypeId) => ({
        staffId: staff.id,
        roleTypeId: Number(roleTypeId),
      })),
    });
  }

  // プロジェクトを割り当て
  if (projectIds.length > 0) {
    await prisma.staffProjectAssignment.createMany({
      data: projectIds.map((projectId) => ({
        staffId: staff.id,
        projectId: Number(projectId),
      })),
    });
  }

  revalidatePath("/staff");
}

export async function updateStaff(id: number, data: Record<string, unknown>) {
  const roleTypeIds = (data.roleTypeIds as string[]) || [];
  const projectIds = (data.projectIds as string[]) || [];

  await prisma.masterStaff.update({
    where: { id },
    data: {
      name: data.name as string,
      nameKana: (data.nameKana as string) || null,
      email: (data.email as string) || null,
      phone: (data.phone as string) || null,
      contractType: (data.contractType as string) || null,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });

  // 役割を更新（既存を削除して再作成）
  await prisma.staffRoleAssignment.deleteMany({
    where: { staffId: id },
  });

  if (roleTypeIds.length > 0) {
    await prisma.staffRoleAssignment.createMany({
      data: roleTypeIds.map((roleTypeId) => ({
        staffId: id,
        roleTypeId: Number(roleTypeId),
      })),
    });
  }

  // プロジェクトを更新（既存を削除して再作成）
  await prisma.staffProjectAssignment.deleteMany({
    where: { staffId: id },
  });

  if (projectIds.length > 0) {
    await prisma.staffProjectAssignment.createMany({
      data: projectIds.map((projectId) => ({
        staffId: id,
        projectId: Number(projectId),
      })),
    });
  }

  revalidatePath("/staff");
}

export async function deleteStaff(id: number) {
  await prisma.masterStaff.delete({
    where: { id },
  });
  revalidatePath("/staff");
}
