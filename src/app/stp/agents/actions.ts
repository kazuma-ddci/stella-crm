"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEdit } from "@/lib/auth";
import { validateStaffForField } from "@/lib/staff/get-staff-by-field";
import { createFieldChangeLogEntries, FieldChange } from "@/lib/field-change-log.server";
import { isStaffSetEqual, formatStaffEntries } from "@/lib/field-change-log.shared";
import crypto from "crypto";

// ユニークなトークンを生成
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function addAgent(data: Record<string, unknown>) {
  await requireEdit("stp");
  // staffAssignmentsを分離
  const staffAssignmentsRaw = data.staffAssignments as string | string[] | null;
  const staffIds = parseStaffIds(staffAssignmentsRaw);

  // サーバー側スタッフ権限バリデーション
  if (data.adminStaffId) {
    const isValid = await validateStaffForField("STP_AGENT_ADMIN", Number(data.adminStaffId));
    if (!isValid) throw new Error("選択された担当事務はこのフィールドに割り当てできません");
  }

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
        adminStaffId: data.adminStaffId ? Number(data.adminStaffId) : null,
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
  await requireEdit("stp");

  // __changeNotesを取り出す（変更履歴用メモ）
  const changeNotes = (data.__changeNotes as Record<string, string>) || {};
  delete data.__changeNotes;

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

  // 担当事務ID
  if ("adminStaffId" in data) {
    const staffId = data.adminStaffId ? Number(data.adminStaffId) : null;
    if (staffId) {
      const isValid = await validateStaffForField("STP_AGENT_ADMIN", staffId);
      if (!isValid) throw new Error("選択された担当事務はこのフィールドに割り当てできません");
    }
    updateData.adminStaffId = staffId;
  }

  // staffAssignmentsが渡された場合は担当者も更新
  const hasStaffAssignments = "staffAssignments" in data;
  const staffIds = hasStaffAssignments
    ? parseStaffIds(data.staffAssignments as string | string[] | null)
    : [];

  // 変更履歴管理対象フィールドのチェック
  const hasTrackedStaffAssignments = hasStaffAssignments && changeNotes.staffAssignments;
  const hasTrackedAdminStaff = "adminStaffId" in data && changeNotes.adminStaffId;

  await prisma.$transaction(async (tx) => {
    // 変更履歴ログの作成
    if (hasTrackedStaffAssignments || hasTrackedAdminStaff) {
      const agent = await tx.stpAgent.findUnique({
        where: { id },
        include: {
          staffAssignments: { include: { staff: true } },
          adminStaff: true,
        },
      });

      if (agent) {
        const changes: FieldChange[] = [];

        // 担当営業（multi-select）の変更 - 集合比較（順序無関係）、ID付き表示
        if (hasTrackedStaffAssignments) {
          const oldEntries = agent.staffAssignments.map((sa) => ({ id: sa.staffId, name: sa.staff.name }));
          let newEntries: { id: number; name: string }[] = [];
          if (staffIds.length > 0) {
            const newStaff = await tx.masterStaff.findMany({
              where: { id: { in: staffIds } },
              select: { id: true, name: true },
            });
            newEntries = staffIds.map((sid) => ({
              id: sid,
              name: newStaff.find((s) => s.id === sid)?.name || String(sid),
            }));
          }

          if (!isStaffSetEqual(oldEntries, newEntries)) {
            changes.push({
              fieldName: "staffAssignments",
              displayName: "担当営業",
              oldValue: formatStaffEntries(oldEntries),
              newValue: formatStaffEntries(newEntries),
              note: changeNotes.staffAssignments,
            });
          }
        }

        // 担当事務の変更
        if (hasTrackedAdminStaff) {
          const oldValue = agent.adminStaff?.name || (agent.adminStaffId ? String(agent.adminStaffId) : null);
          let newValue: string | null = null;
          const newStaffId = updateData.adminStaffId as number | null;
          if (newStaffId) {
            const staff = await tx.masterStaff.findUnique({ where: { id: newStaffId }, select: { name: true } });
            newValue = staff?.name || String(newStaffId);
          }
          if (oldValue !== newValue) {
            changes.push({
              fieldName: "adminStaffId",
              displayName: "担当事務",
              oldValue,
              newValue,
              note: changeNotes.adminStaffId,
            });
          }
        }

        if (changes.length > 0) {
          await createFieldChangeLogEntries(tx, "stp_agent", id, changes);
        }
      }
    }

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
  await requireEdit("stp");
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
