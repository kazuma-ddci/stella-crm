"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function addAgent(data: Record<string, unknown>) {
  // staffAssignmentsを分離
  const staffAssignmentsRaw = data.staffAssignments as string | string[] | null;
  const staffIds = parseStaffIds(staffAssignmentsRaw);

  await prisma.stpAgent.create({
    data: {
      companyId: Number(data.companyId),
      status: (data.status as string) || "アクティブ",
      category1: (data.category1 as string) || "代理店",
      category2: (data.category2 as string) || "法人",
      meetingDate: data.meetingDate ? new Date(data.meetingDate as string) : null,
      contractStatus: (data.contractStatus as string) || null,
      contractNote: (data.contractNote as string) || null,
      referrerCompanyId: data.referrerCompanyId ? Number(data.referrerCompanyId) : null,
      note: (data.note as string) || null,
      staffAssignments: {
        create: staffIds.map((staffId) => ({ staffId })),
      },
    },
  });
  revalidatePath("/stp/agents");
}

export async function updateAgent(id: number, data: Record<string, unknown>) {
  // staffAssignmentsを分離
  const staffAssignmentsRaw = data.staffAssignments as string | string[] | null;
  const staffIds = parseStaffIds(staffAssignmentsRaw);

  await prisma.$transaction(async (tx) => {
    // 代理店情報を更新
    await tx.stpAgent.update({
      where: { id },
      data: {
        companyId: Number(data.companyId),
        status: (data.status as string) || "アクティブ",
        category1: (data.category1 as string) || "代理店",
        category2: (data.category2 as string) || "法人",
        meetingDate: data.meetingDate ? new Date(data.meetingDate as string) : null,
        contractStatus: (data.contractStatus as string) || null,
        contractNote: (data.contractNote as string) || null,
        referrerCompanyId: data.referrerCompanyId ? Number(data.referrerCompanyId) : null,
        note: (data.note as string) || null,
      },
    });

    // 担当者を更新（既存を全削除してから追加）
    await tx.stpAgentStaff.deleteMany({
      where: { agentId: id },
    });

    if (staffIds.length > 0) {
      await tx.stpAgentStaff.createMany({
        data: staffIds.map((staffId) => ({ agentId: id, staffId })),
      });
    }
  });

  revalidatePath("/stp/agents");
}

export async function deleteAgent(id: number) {
  await prisma.stpAgent.delete({
    where: { id },
  });
  revalidatePath("/stp/agents");
}

// staffAssignmentsのパース関数
function parseStaffIds(raw: string | string[] | null): number[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(Number).filter((n) => !isNaN(n));
  }
  // カンマ区切りの文字列の場合
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => !isNaN(n));
}
