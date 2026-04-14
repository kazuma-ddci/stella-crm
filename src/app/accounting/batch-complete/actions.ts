"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordChangeLog } from "@/app/finance/changelog/actions";
import { createNotification } from "@/lib/notifications/create-notification";
import { toLocalDateString } from "@/lib/utils";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffForAccounting } from "@/lib/auth/staff-action";

// ============================================
// 型定義
// ============================================

export type AwaitingGroupItem = {
  id: number;
  groupType: "invoice" | "payment";
  counterpartyName: string;
  operatingCompanyName: string;
  projectName: string | null;
  totalAmount: number | null;
  taxAmount: number | null;
  status: string;
  label: string; // 請求書番号 or 対象月
  transactionCount: number;
  allocationItemCount: number;
  hasUnprocessedAllocations: boolean;
  createdAt: string;
};

// ============================================
// 経理処理待ちグループ一覧取得
// ============================================

export async function getAwaitingAccountingGroups(): Promise<AwaitingGroupItem[]> {
  // 認証: 経理プロジェクトの閲覧権限以上
  await requireStaffForAccounting("view");

  const results: AwaitingGroupItem[] = [];

  // 請求グループ: awaiting_accounting, partially_paid
  const invoiceGroups = await prisma.invoiceGroup.findMany({
    where: {
      deletedAt: null,
      status: { in: ["awaiting_accounting", "partially_paid"] },
    },
    include: {
      counterparty: { select: { name: true } },
      operatingCompany: { select: { companyName: true } },
      project: { select: { name: true } },
      transactions: {
        where: { deletedAt: null },
        select: {
          id: true,
          allocationTemplateId: true,
          allocationConfirmations: { select: { costCenterId: true } },
        },
      },
      allocationItems: {
        select: {
          id: true,
          transactionId: true,
          costCenterId: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  for (const g of invoiceGroups) {
    // 按分取引の全PJ処理状況を確認
    let hasUnprocessed = false;
    for (const tx of g.transactions) {
      if (!tx.allocationTemplateId) continue;
      // allocationTemplateのlines数とallocationItemsのグループ内の数を比較
      // 簡易チェック: このグループ内の取引の按分テンプレートに対して、全CCのAllocationGroupItemが存在するか
      const template = await prisma.allocationTemplate.findUnique({
        where: { id: tx.allocationTemplateId },
        include: { lines: { where: { costCenterId: { not: null } } } },
      });
      if (template) {
        const existingItems = await prisma.allocationGroupItem.findMany({
          where: { transactionId: tx.id, groupType: "invoice" },
          select: { costCenterId: true },
        });
        const processedCcIds = new Set(existingItems.map((i) => i.costCenterId));
        for (const line of template.lines) {
          if (line.costCenterId && !processedCcIds.has(line.costCenterId)) {
            hasUnprocessed = true;
            break;
          }
        }
      }
      if (hasUnprocessed) break;
    }

    results.push({
      id: g.id,
      groupType: "invoice",
      counterpartyName: g.counterparty.name,
      operatingCompanyName: g.operatingCompany.companyName,
      projectName: g.project?.name ?? null,
      totalAmount: g.totalAmount,
      taxAmount: g.taxAmount,
      status: g.status,
      label: g.invoiceNumber ?? `請求#${g.id}`,
      transactionCount: g.transactions.length,
      allocationItemCount: g.allocationItems.length,
      hasUnprocessedAllocations: hasUnprocessed,
      createdAt: toLocalDateString(g.createdAt),
    });
  }

  // 支払グループ: awaiting_accounting
  const paymentGroups = await prisma.paymentGroup.findMany({
    where: {
      deletedAt: null,
      status: { in: ["awaiting_accounting"] },
    },
    include: {
      counterparty: { select: { name: true } },
      operatingCompany: { select: { companyName: true } },
      project: { select: { name: true } },
      transactions: {
        where: { deletedAt: null },
        select: {
          id: true,
          allocationTemplateId: true,
        },
      },
      allocationItems: {
        select: {
          id: true,
          transactionId: true,
          costCenterId: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  for (const g of paymentGroups) {
    let hasUnprocessed = false;
    for (const tx of g.transactions) {
      if (!tx.allocationTemplateId) continue;
      const template = await prisma.allocationTemplate.findUnique({
        where: { id: tx.allocationTemplateId },
        include: { lines: { where: { costCenterId: { not: null } } } },
      });
      if (template) {
        const existingItems = await prisma.allocationGroupItem.findMany({
          where: { transactionId: tx.id, groupType: "payment" },
          select: { costCenterId: true },
        });
        const processedCcIds = new Set(existingItems.map((i) => i.costCenterId));
        for (const line of template.lines) {
          if (line.costCenterId && !processedCcIds.has(line.costCenterId)) {
            hasUnprocessed = true;
            break;
          }
        }
      }
      if (hasUnprocessed) break;
    }

    const month = g.targetMonth;
    results.push({
      id: g.id,
      groupType: "payment",
      counterpartyName: g.counterparty?.name ?? "（未設定）",
      operatingCompanyName: g.operatingCompany.companyName,
      projectName: g.project?.name ?? null,
      totalAmount: g.totalAmount,
      taxAmount: g.taxAmount,
      status: g.status,
      label: month ? `支払 ${month.getUTCFullYear()}/${String(month.getUTCMonth() + 1).padStart(2, "0")}` : "支払（対象月未設定）",
      transactionCount: g.transactions.length,
      allocationItemCount: g.allocationItems.length,
      hasUnprocessedAllocations: hasUnprocessed,
      createdAt: toLocalDateString(g.createdAt),
    });
  }

  return results;
}

// ============================================
// グループをSTP側に差し戻し
// ============================================

export async function returnGroupToStp(
  groupId: number,
  groupType: "invoice" | "payment",
  reason?: string
): Promise<ActionResult> {
  try {
  const session = await getSession();
  const staffId = session.id;

  if (groupType === "invoice") {
    const group = await prisma.invoiceGroup.findFirst({
      where: { id: groupId, deletedAt: null },
      select: { id: true, status: true, createdBy: true },
    });
    if (!group) return err("請求グループが見つかりません");
    if (!["awaiting_accounting", "partially_paid"].includes(group.status)) {
      return err("このステータスでは差し戻しできません");
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoiceGroup.update({
        where: { id: groupId },
        data: { status: "returned" },
      });
      if (reason) {
        await tx.transactionComment.create({
          data: {
            invoiceGroupId: groupId,
            body: reason,
            commentType: "return",
            returnReasonType: "accounting_return",
            createdBy: staffId,
          },
        });
      }
      await recordChangeLog(
        {
          tableName: "InvoiceGroup",
          recordId: groupId,
          changeType: "update",
          oldData: { status: group.status },
          newData: { status: "returned" },
        },
        staffId,
        tx
      );
    });

    if (group.createdBy && group.createdBy !== staffId) {
      await createNotification({
        recipientId: group.createdBy,
        senderType: "staff",
        senderId: staffId,
        category: "accounting",
        title: "請求グループが差し戻されました",
        message: reason || "経理担当者により差し戻されました",
        linkUrl: "/stp/finance/invoices",
      });
    }
  } else {
    const group = await prisma.paymentGroup.findFirst({
      where: { id: groupId, deletedAt: null },
      select: { id: true, status: true, createdBy: true },
    });
    if (!group) return err("支払グループが見つかりません");
    if (group.status !== "awaiting_accounting") {
      return err("このステータスでは差し戻しできません");
    }

    await prisma.$transaction(async (tx) => {
      await tx.paymentGroup.update({
        where: { id: groupId },
        data: { status: "returned" },
      });
      if (reason) {
        await tx.transactionComment.create({
          data: {
            paymentGroupId: groupId,
            body: reason,
            commentType: "return",
            returnReasonType: "accounting_return",
            createdBy: staffId,
          },
        });
      }
      await recordChangeLog(
        {
          tableName: "PaymentGroup",
          recordId: groupId,
          changeType: "update",
          oldData: { status: group.status },
          newData: { status: "returned" },
        },
        staffId,
        tx
      );
    });

    if (group.createdBy && group.createdBy !== staffId) {
      await createNotification({
        recipientId: group.createdBy,
        senderType: "staff",
        senderId: staffId,
        category: "accounting",
        title: "支払グループが差し戻されました",
        message: reason || "経理担当者により差し戻されました",
        linkUrl: "/stp/finance/payment-groups",
      });
    }
  }

  revalidatePath("/accounting/batch-complete");
  revalidatePath("/stp/finance/invoices");
  revalidatePath("/stp/finance/payment-groups");
  return ok();
  } catch (e) {
    console.error("[returnGroupToStp] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
