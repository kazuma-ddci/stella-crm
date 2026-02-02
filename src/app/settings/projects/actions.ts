"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function addProject(data: Record<string, unknown>) {
  // 最大の表示順を取得して+1
  const maxOrder = await prisma.masterProject.aggregate({
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  await prisma.masterProject.create({
    data: {
      name: data.name as string,
      description: (data.description as string) || null,
      displayOrder,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/settings/projects");
}

export async function updateProject(id: number, data: Record<string, unknown>) {
  await prisma.masterProject.update({
    where: { id },
    data: {
      name: data.name as string,
      description: (data.description as string) || null,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/settings/projects");
}

export async function deleteProject(id: number) {
  await prisma.masterProject.delete({
    where: { id },
  });
  revalidatePath("/settings/projects");
}

export async function reorderProjects(orderedIds: number[]) {
  // トランザクションで一括更新
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.masterProject.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );
  revalidatePath("/settings/projects");
}
