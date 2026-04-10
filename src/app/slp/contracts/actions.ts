"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { syncContractStatus } from "@/lib/cloudsign-sync";
import { cloudsignClient } from "@/lib/cloudsign";
import { sendSlpRemind } from "@/lib/slp-cloudsign";
import { recordStatusChangeIfNeeded } from "@/lib/contract-status/record-status-change";
import { ok, err, type ActionResult } from "@/lib/action-result";

/**
 * 自動同期のON/OFF切替
 */
export async function toggleAutoSync(contractId: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission("slp");

    const contract = await prisma.masterContract.findUnique({
      where: { id: contractId },
      select: { cloudsignAutoSync: true, cloudsignDocumentId: true, cloudsignStatus: true, currentStatusId: true, cloudsignTitle: true, projectId: true },
    });
    if (!contract) return err("契約書が見つかりません");

    const newAutoSync = !contract.cloudsignAutoSync;

    await prisma.masterContract.update({
      where: { id: contractId },
      data: { cloudsignAutoSync: newAutoSync },
    });

    // 自動同期をONにした場合、即座に最新ステータスを同期
    if (newAutoSync && contract.cloudsignDocumentId) {
      try {
        const project = await prisma.masterProject.findUnique({
          where: { id: contract.projectId },
          include: { operatingCompany: { select: { cloudsignClientId: true } } },
        });
        const clientId = project?.operatingCompany?.cloudsignClientId;
        if (clientId) {
          const token = await cloudsignClient.getToken(clientId);
          const doc = await cloudsignClient.getDocument(token, contract.cloudsignDocumentId);

          let mappedStatus: string | null = null;
          if (doc.status === 0) mappedStatus = "draft";
          else if (doc.status === 1) mappedStatus = "sent";
          else if (doc.status === 2) mappedStatus = "completed";

          if (mappedStatus && mappedStatus !== contract.cloudsignStatus) {
            await syncContractStatus(
              {
                id: contractId,
                currentStatusId: contract.currentStatusId,
                cloudsignStatus: contract.cloudsignStatus,
                cloudsignTitle: contract.cloudsignTitle,
                cloudsignDocumentId: contract.cloudsignDocumentId,
              },
              clientId,
              mappedStatus,
              "手動同期（自動同期再開時）"
            );
          }
        }
      } catch (e2) {
        console.error("[SLP Contract] Auto-sync re-enable sync failed:", e2);
      }
    }

    revalidatePath("/slp/contracts");
    return ok();
  } catch (e) {
    console.error("[toggleAutoSync] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * 手動でCloudSignステータスを同期
 */
export async function manualSync(contractId: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission("slp");

    const contract = await prisma.masterContract.findUnique({
      where: { id: contractId },
      select: { cloudsignDocumentId: true, cloudsignStatus: true, currentStatusId: true, cloudsignTitle: true, projectId: true, filePath: true },
    });
    if (!contract) return err("契約書が見つかりません");
    if (!contract.cloudsignDocumentId) return err("CloudSign書類IDがありません");

    const project = await prisma.masterProject.findUnique({
      where: { id: contract.projectId },
      include: { operatingCompany: { select: { cloudsignClientId: true } } },
    });
    const clientId = project?.operatingCompany?.cloudsignClientId;
    if (!clientId) return err("CloudSign APIキーが設定されていません");

    const token = await cloudsignClient.getToken(clientId);
    const doc = await cloudsignClient.getDocument(token, contract.cloudsignDocumentId);

    let mappedStatus: string | null = null;
    if (doc.status === 0) mappedStatus = "draft";
    else if (doc.status === 1) mappedStatus = "sent";
    else if (doc.status === 2) mappedStatus = "completed";

    if (mappedStatus) {
      await syncContractStatus(
        {
          id: contractId,
          currentStatusId: contract.currentStatusId,
          cloudsignStatus: contract.cloudsignStatus,
          cloudsignTitle: contract.cloudsignTitle,
          cloudsignDocumentId: contract.cloudsignDocumentId,
        },
        clientId,
        mappedStatus,
        "手動同期"
      );
    }

    revalidatePath("/slp/contracts");
    return ok();
  } catch (e) {
    console.error("[manualSync] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * リマインド送付
 */
export async function remindContract(contractId: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission("slp");

    await sendSlpRemind(contractId);

    // 紐づくSlpMemberの旧カラムも更新
    const contract = await prisma.masterContract.findUnique({
      where: { id: contractId },
      select: { slpMemberId: true },
    });
    if (contract?.slpMemberId) {
      await prisma.slpMember.update({
        where: { id: contract.slpMemberId },
        data: {
          reminderCount: { increment: 1 },
          lastReminderSentAt: new Date(),
        },
      });
    }

    revalidatePath("/slp/contracts");
    revalidatePath("/slp/members");
    return ok();
  } catch (e) {
    console.error("[remindContract] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * ステータスを手動変更
 */
export async function updateContractStatus(
  contractId: number,
  newStatusId: number,
  note?: string
): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission("slp");

    const contract = await prisma.masterContract.findUnique({
      where: { id: contractId },
      select: { currentStatusId: true, slpMemberId: true },
    });
    if (!contract) return err("契約書が見つかりません");

    const newStatus = await prisma.masterContractStatus.findUnique({
      where: { id: newStatusId },
    });
    if (!newStatus) return err("ステータスが見つかりません");

    await prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {
        currentStatusId: newStatusId,
      };

      if (newStatus.statusType === "signed") {
        updateData.signedDate = new Date();
        updateData.cloudsignStatus = "completed";
        updateData.cloudsignCompletedAt = new Date();
      } else if (newStatus.statusType === "discarded") {
        updateData.cloudsignStatus = "canceled_by_sender";
      }

      await tx.masterContract.update({
        where: { id: contractId },
        data: updateData,
      });

      await recordStatusChangeIfNeeded(
        tx,
        contractId,
        contract.currentStatusId,
        newStatusId,
        note ? `手動変更: ${note}` : "手動変更"
      );
    });

    // SlpMemberの旧カラムも同期
    if (contract.slpMemberId) {
      if (newStatus.statusType === "signed") {
        await prisma.slpMember.update({
          where: { id: contract.slpMemberId },
          data: { status: "組合員契約書締結", contractSignedDate: new Date() },
        });
      } else if (newStatus.statusType === "discarded") {
        await prisma.slpMember.update({
          where: { id: contract.slpMemberId },
          data: { status: "契約破棄" },
        });
      }
    }

    revalidatePath("/slp/contracts");
    revalidatePath("/slp/members");
    return ok();
  } catch (e) {
    console.error("[updateContractStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
