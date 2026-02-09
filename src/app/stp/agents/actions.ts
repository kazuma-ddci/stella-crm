"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// ユニークなトークンを生成
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function addAgent(data: Record<string, unknown>) {
  // staffAssignmentsを分離
  const staffAssignmentsRaw = data.staffAssignments as string | string[] | null;
  const staffIds = parseStaffIds(staffAssignmentsRaw);

  await prisma.$transaction(async (tx) => {
    // companyIdの重複チェック（DB UNIQUE制約の代替）
    const existing = await tx.stpAgent.findFirst({
      where: { companyId: Number(data.companyId) },
    });
    if (existing) {
      throw new Error("この企業は既に代理店として登録されています");
    }

    // 代理店を作成
    const agent = await tx.stpAgent.create({
      data: {
        companyId: Number(data.companyId),
        status: (data.status as string) || "アクティブ",
        category1: (data.category1 as string) || "代理店",
        referrerCompanyId: data.referrerCompanyId ? Number(data.referrerCompanyId) : null,
        note: (data.note as string) || null,
        minimumCases: data.minimumCases ? Number(data.minimumCases) : null,
        monthlyFee: data.monthlyFee ? Number(data.monthlyFee) : null,
        staffAssignments: {
          create: staffIds.map((staffId) => ({ staffId })),
        },
      },
    });

    // リード獲得フォームのトークンを自動生成
    await tx.stpLeadFormToken.create({
      data: {
        token: generateToken(),
        agentId: agent.id,
        status: "active",
      },
    });
  });

  revalidatePath("/stp/agents");
}

export async function updateAgent(id: number, data: Record<string, unknown>) {
  // 更新データを動的に構築（渡されたフィールドのみ更新）
  const updateData: Record<string, unknown> = {};

  if ("status" in data) {
    updateData.status = (data.status as string) || "アクティブ";
  }
  if ("category1" in data) {
    updateData.category1 = (data.category1 as string) || "代理店";
  }
  if ("referrerCompanyId" in data) {
    updateData.referrerCompanyId = data.referrerCompanyId ? Number(data.referrerCompanyId) : null;
  }
  if ("note" in data) {
    updateData.note = (data.note as string) || null;
  }
  if ("minimumCases" in data) {
    updateData.minimumCases = data.minimumCases !== null && data.minimumCases !== undefined
      ? Number(data.minimumCases)
      : null;
  }
  if ("monthlyFee" in data) {
    updateData.monthlyFee = data.monthlyFee !== null && data.monthlyFee !== undefined
      ? Number(data.monthlyFee)
      : null;
  }
  if ("isIndividualBusiness" in data) {
    updateData.isIndividualBusiness = data.isIndividualBusiness === true || data.isIndividualBusiness === "true";
  }
  if ("withholdingTaxRate" in data) {
    updateData.withholdingTaxRate = data.withholdingTaxRate !== null && data.withholdingTaxRate !== undefined
      ? Number(data.withholdingTaxRate)
      : null;
  }

  // staffAssignmentsが渡された場合は担当者も更新
  const hasStaffAssignments = "staffAssignments" in data;
  const staffIds = hasStaffAssignments
    ? parseStaffIds(data.staffAssignments as string | string[] | null)
    : [];

  await prisma.$transaction(async (tx) => {
    // 代理店情報を更新（渡されたフィールドのみ）
    if (Object.keys(updateData).length > 0) {
      await tx.stpAgent.update({
        where: { id },
        data: updateData,
      });
    }

    // 担当者を更新（staffAssignmentsが渡された場合のみ）
    if (hasStaffAssignments) {
      await tx.stpAgentStaff.deleteMany({
        where: { agentId: id },
      });

      if (staffIds.length > 0) {
        await tx.stpAgentStaff.createMany({
          data: staffIds.map((staffId) => ({ agentId: id, staffId })),
        });
      }
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
