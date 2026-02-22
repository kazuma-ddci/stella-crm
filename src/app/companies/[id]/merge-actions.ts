"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRelatedDataCounts } from "@/lib/company/get-related-data-counts";
import type {
  MergePreview,
  MergeResolution,
  MergeResult,
  FieldDiff,
} from "@/types/company-merge";

/** マージプレビューを取得 */
export async function getMergePreview(
  survivorId: number,
  duplicateId: number
): Promise<MergePreview> {
  const [survivor, duplicate] = await Promise.all([
    prisma.masterStellaCompany.findUniqueOrThrow({
      where: { id: survivorId },
      include: {
        stpCompanies: { include: { currentStage: true } },
        agentCompanies: true,
      },
    }),
    prisma.masterStellaCompany.findUniqueOrThrow({
      where: { id: duplicateId },
      include: {
        stpCompanies: { include: { currentStage: true } },
        agentCompanies: true,
      },
    }),
  ]);

  const [survivorCounts, duplicateCounts] = await Promise.all([
    getRelatedDataCounts(survivorId),
    getRelatedDataCounts(duplicateId),
  ]);

  // StpCompany衝突検出: 両方にStpCompanyが存在する場合
  const stpCompanyConflicts =
    survivor.stpCompanies.length > 0 && duplicate.stpCompanies.length > 0
      ? [
          {
            survivorStpCompanyId: survivor.stpCompanies[0].id,
            duplicateStpCompanyId: duplicate.stpCompanies[0].id,
            survivorStageName: survivor.stpCompanies[0].currentStage?.name ?? null,
            duplicateStageName: duplicate.stpCompanies[0].currentStage?.name ?? null,
          },
        ]
      : [];

  // StpAgent衝突検出: 両方にStpAgentが存在する場合
  const stpAgentConflicts =
    survivor.agentCompanies.length > 0 && duplicate.agentCompanies.length > 0
      ? [
          {
            survivorAgentId: survivor.agentCompanies[0].id,
            duplicateAgentId: duplicate.agentCompanies[0].id,
            survivorCategory: survivor.agentCompanies[0].category1,
            duplicateCategory: duplicate.agentCompanies[0].category1,
          },
        ]
      : [];

  // 基本情報フィールドの差分を計算
  const fieldDefs: { field: keyof typeof survivor; label: string }[] = [
    { field: "corporateNumber", label: "法人番号" },
    { field: "companyType", label: "区分" },
    { field: "websiteUrl", label: "企業HP" },
    { field: "industry", label: "業界" },
    { field: "revenueScale", label: "売上規模" },
    { field: "leadSource", label: "流入経路" },
    { field: "note", label: "メモ" },
  ];

  const fieldDiffs: FieldDiff[] = fieldDefs
    .filter((def) => {
      const sVal = survivor[def.field];
      const dVal = duplicate[def.field];
      return sVal !== dVal && (sVal || dVal);
    })
    .map((def) => ({
      field: def.field,
      label: def.label,
      survivorValue: (survivor[def.field] as string | null) ?? null,
      duplicateValue: (duplicate[def.field] as string | null) ?? null,
    }));

  return {
    survivor: {
      id: survivor.id,
      companyCode: survivor.companyCode,
      name: survivor.name,
      relatedData: survivorCounts,
    },
    duplicate: {
      id: duplicate.id,
      companyCode: duplicate.companyCode,
      name: duplicate.name,
      relatedData: duplicateCounts,
    },
    stpCompanyConflicts,
    stpAgentConflicts,
    fieldDiffs,
  };
}

/** StpCompanyの子レコードをまとめて移動 */
async function moveStpCompanyChildren(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  fromStpCompanyId: number,
  toStpCompanyId: number
) {
  await Promise.all([
    tx.stpStageHistory.updateMany({
      where: { stpCompanyId: fromStpCompanyId },
      data: { stpCompanyId: toStpCompanyId },
    }),
    tx.stpCompanyContract.updateMany({
      where: { stpCompanyId: fromStpCompanyId },
      data: { stpCompanyId: toStpCompanyId },
    }),
    tx.stpProposal.updateMany({
      where: { stpCompanyId: fromStpCompanyId },
      data: { stpCompanyId: toStpCompanyId },
    }),
    tx.stpKpiSheet.updateMany({
      where: { stpCompanyId: fromStpCompanyId },
      data: { stpCompanyId: toStpCompanyId },
    }),
    tx.stpCandidate.updateMany({
      where: { stpCompanyId: fromStpCompanyId },
      data: { stpCompanyId: toStpCompanyId },
    }),
    tx.stpRevenueRecord.updateMany({
      where: { stpCompanyId: fromStpCompanyId },
      data: { stpCompanyId: toStpCompanyId },
    }),
    tx.stpExpenseRecord.updateMany({
      where: { stpCompanyId: fromStpCompanyId },
      data: { stpCompanyId: toStpCompanyId },
    }),
    tx.stpAgentCommissionOverride.updateMany({
      where: { stpCompanyId: fromStpCompanyId },
      data: { stpCompanyId: toStpCompanyId },
    }),
    tx.stpInvoice.updateMany({
      where: { stpCompanyId: fromStpCompanyId },
      data: { stpCompanyId: toStpCompanyId },
    }),
  ]);
}

/** StpAgentの子レコードをまとめて移動 */
async function moveStpAgentChildren(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  fromAgentId: number,
  toAgentId: number
) {
  // StpAgentStaffは@@unique([agentId, staffId])があるので重複スキップ
  const existingStaff = await tx.stpAgentStaff.findMany({
    where: { agentId: toAgentId },
    select: { staffId: true },
  });
  const existingStaffIds = new Set(existingStaff.map((s) => s.staffId));

  const fromStaff = await tx.stpAgentStaff.findMany({
    where: { agentId: fromAgentId },
  });
  for (const staff of fromStaff) {
    if (!existingStaffIds.has(staff.staffId)) {
      await tx.stpAgentStaff.update({
        where: { id: staff.id },
        data: { agentId: toAgentId },
      });
    } else {
      await tx.stpAgentStaff.delete({ where: { id: staff.id } });
    }
  }

  // StpLeadFormTokenは@uniqueなので先に削除
  await tx.stpLeadFormToken.deleteMany({ where: { agentId: fromAgentId } });

  await Promise.all([
    tx.stpAgentContract.updateMany({
      where: { agentId: fromAgentId },
      data: { agentId: toAgentId },
    }),
    tx.stpAgentContractHistory.updateMany({
      where: { agentId: fromAgentId },
      data: { agentId: toAgentId },
    }),
    tx.stpExpenseRecord.updateMany({
      where: { agentId: fromAgentId },
      data: { agentId: toAgentId },
    }),
    tx.stpInvoice.updateMany({
      where: { agentId: fromAgentId },
      data: { agentId: toAgentId },
    }),
    // StpCompanyのagentId更新
    tx.stpCompany.updateMany({
      where: { agentId: fromAgentId },
      data: { agentId: toAgentId },
    }),
  ]);
}

/** マージを実行 */
export async function executeMerge(
  survivorId: number,
  duplicateId: number,
  resolution: MergeResolution
): Promise<MergeResult> {
  try {
    const warnings: string[] = [];

    await prisma.$transaction(
      async (tx) => {
        // 1. 1:NデータのFK付け替え
        await Promise.all([
          tx.stellaCompanyLocation.updateMany({
            where: { companyId: duplicateId },
            data: { companyId: survivorId },
          }),
          tx.stellaCompanyContact.updateMany({
            where: { companyId: duplicateId },
            data: { companyId: survivorId },
          }),
          tx.stellaCompanyBankAccount.updateMany({
            where: { companyId: duplicateId },
            data: { companyId: survivorId },
          }),
          tx.stpContractHistory.updateMany({
            where: { companyId: duplicateId },
            data: { companyId: survivorId },
          }),
          tx.contactHistory.updateMany({
            where: { companyId: duplicateId },
            data: { companyId: survivorId },
          }),
          tx.masterContract.updateMany({
            where: { companyId: duplicateId },
            data: { companyId: survivorId },
          }),
          tx.externalUser.updateMany({
            where: { companyId: duplicateId },
            data: { companyId: survivorId },
          }),
          tx.registrationToken.updateMany({
            where: { companyId: duplicateId },
            data: { companyId: survivorId },
          }),
          // referredAgents: 紹介元企業IDの付け替え
          tx.stpAgent.updateMany({
            where: { referrerCompanyId: duplicateId },
            data: { referrerCompanyId: survivorId },
          }),
          // LeadFormSubmission
          tx.stpLeadFormSubmission.updateMany({
            where: { masterCompanyId: duplicateId },
            data: { masterCompanyId: survivorId },
          }),
        ]);

        // 2. StpCompany衝突処理
        const duplicateStpCompanies = await tx.stpCompany.findMany({
          where: { companyId: duplicateId },
        });
        const survivorStpCompanies = await tx.stpCompany.findMany({
          where: { companyId: survivorId },
        });

        if (duplicateStpCompanies.length > 0 && survivorStpCompanies.length > 0) {
          const stpRes = resolution.stpCompanyResolution || "keep_both";

          if (stpRes === "keep_a") {
            // 統合先を残す: Bの子レコードをAに移動→B削除
            for (const dupStp of duplicateStpCompanies) {
              await moveStpCompanyChildren(tx, dupStp.id, survivorStpCompanies[0].id);
              await tx.stpCompany.delete({ where: { id: dupStp.id } });
            }
          } else if (stpRes === "keep_b") {
            // 統合元を残す: Aの子レコードをBに移動→A削除、BのcompanyIdを更新
            for (const surStp of survivorStpCompanies) {
              await moveStpCompanyChildren(tx, surStp.id, duplicateStpCompanies[0].id);
              await tx.stpCompany.delete({ where: { id: surStp.id } });
            }
            for (const dupStp of duplicateStpCompanies) {
              await tx.stpCompany.update({
                where: { id: dupStp.id },
                data: { companyId: survivorId },
              });
            }
          } else {
            // keep_both: companyIdだけ更新
            for (const dupStp of duplicateStpCompanies) {
              await tx.stpCompany.update({
                where: { id: dupStp.id },
                data: { companyId: survivorId },
              });
            }
            warnings.push(
              "STP企業が重複しています。STP企業一覧で確認し、不要な方を削除してください。"
            );
          }
        } else if (duplicateStpCompanies.length > 0) {
          // 衝突なし: companyIdを付け替え
          for (const dupStp of duplicateStpCompanies) {
            await tx.stpCompany.update({
              where: { id: dupStp.id },
              data: { companyId: survivorId },
            });
          }
        }

        // 3. StpAgent衝突処理
        const duplicateAgents = await tx.stpAgent.findMany({
          where: { companyId: duplicateId },
        });
        const survivorAgents = await tx.stpAgent.findMany({
          where: { companyId: survivorId },
        });

        if (duplicateAgents.length > 0 && survivorAgents.length > 0) {
          const agentRes = resolution.stpAgentResolution || "keep_both";

          if (agentRes === "keep_a") {
            for (const dupAgent of duplicateAgents) {
              await moveStpAgentChildren(tx, dupAgent.id, survivorAgents[0].id);
              await tx.stpAgent.delete({ where: { id: dupAgent.id } });
            }
          } else if (agentRes === "keep_b") {
            for (const surAgent of survivorAgents) {
              await moveStpAgentChildren(tx, surAgent.id, duplicateAgents[0].id);
              await tx.stpAgent.delete({ where: { id: surAgent.id } });
            }
            for (const dupAgent of duplicateAgents) {
              await tx.stpAgent.update({
                where: { id: dupAgent.id },
                data: { companyId: survivorId },
              });
            }
          } else {
            for (const dupAgent of duplicateAgents) {
              await tx.stpAgent.update({
                where: { id: dupAgent.id },
                data: { companyId: survivorId },
              });
            }
            warnings.push(
              "代理店が重複しています。代理店一覧で確認し、不要な方を削除してください。"
            );
          }
        } else if (duplicateAgents.length > 0) {
          for (const dupAgent of duplicateAgents) {
            await tx.stpAgent.update({
              where: { id: dupAgent.id },
              data: { companyId: survivorId },
            });
          }
        }

        // 4. 企業Bにマージ済みフラグを設定
        await tx.masterStellaCompany.update({
          where: { id: duplicateId },
          data: {
            mergedIntoId: survivorId,
            mergedAt: new Date(),
          },
        });
      },
      { timeout: 30000 }
    );

    // パスの再検証
    revalidatePath("/companies");
    revalidatePath(`/companies/${survivorId}`);
    revalidatePath(`/companies/${duplicateId}`);
    revalidatePath("/stp/companies");
    revalidatePath("/stp/agents");

    return {
      success: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error("Merge failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "統合処理に失敗しました",
    };
  }
}
