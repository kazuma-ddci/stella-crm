"use server";

/**
 * 経理専用の按分グループ項目操作 Server Actions。
 *
 * 経理一括完了画面（/accounting/batch-complete）でのみ使われる：
 * - getRelatedGroupsForTransaction: 取引に紐づく全グループ取得
 * - batchUpdateGroupStatus: 複数グループの一括ステータス更新
 *
 * 共通の按分操作（addAllocationItemToGroup・getGroupAllocationWarnings 等）は
 * src/app/finance/transactions/allocation-group-item-actions.ts を参照。
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { toLocalDateString } from "@/lib/utils";
import { requireStaffForAccounting } from "@/lib/auth/staff-action";

// ===== 按分取引に関連するすべてのグループを取得（経理一括完了用） =====

export async function getRelatedGroupsForTransaction(transactionId: number): Promise<{
  invoiceGroups: { id: number; projectName: string | null; amount: number; status: string }[];
  paymentGroups: { id: number; projectName: string | null; amount: number; status: string }[];
}> {
  await requireStaffForAccounting("view");
  const items = await prisma.allocationGroupItem.findMany({
    where: { transactionId },
    include: {
      invoiceGroup: {
        select: {
          id: true, status: true, totalAmount: true,
          project: { select: { name: true } },
        },
      },
      paymentGroup: {
        select: {
          id: true, status: true, totalAmount: true,
          project: { select: { name: true } },
        },
      },
    },
  });

  const invoiceGroups = items
    .filter((i) => i.invoiceGroup)
    .map((i) => ({
      id: i.invoiceGroup!.id,
      projectName: i.invoiceGroup!.project?.name ?? null,
      amount: i.allocatedAmount,
      status: i.invoiceGroup!.status,
    }));

  const paymentGroups = items
    .filter((i) => i.paymentGroup)
    .map((i) => ({
      id: i.paymentGroup!.id,
      projectName: i.paymentGroup!.project?.name ?? null,
      amount: i.allocatedAmount,
      status: i.paymentGroup!.status,
    }));

  return { invoiceGroups, paymentGroups };
}

// ===== 複数グループの一括ステータス更新（経理一括完了 MVP: 完全一致のみ） =====

export type BatchUpdateResult = {
  success: { groupId: number; groupType: string }[];
  skipped: { groupId: number; groupType: string; reason: string }[];
};

export async function batchUpdateGroupStatus(
  items: { groupId: number; groupType: "invoice" | "payment" }[],
  newStatus: string
): Promise<BatchUpdateResult> {
  await requireStaffForAccounting("edit");
  const result: BatchUpdateResult = { success: [], skipped: [] };

  // InvoiceGroup の有効な遷移
  const invoiceValidTransitions: Record<string, string[]> = {
    awaiting_accounting: ["paid", "returned"],
    partially_paid: ["paid"],
  };

  // PaymentGroup の有効な遷移
  const paymentValidTransitions: Record<string, string[]> = {
    confirmed: ["paid"],
    awaiting_accounting: ["paid", "returned"],
  };

  for (const item of items) {
    try {
      if (item.groupType === "invoice") {
        const group = await prisma.invoiceGroup.findFirst({
          where: { id: item.groupId, deletedAt: null },
        });
        if (!group) {
          result.skipped.push({ ...item, reason: "請求管理レコードが見つかりません" });
          continue;
        }

        const validNextStatuses = invoiceValidTransitions[group.status] ?? [];
        if (!validNextStatuses.includes(newStatus)) {
          result.skipped.push({
            ...item,
            reason: `ステータス「${group.status}」から「${newStatus}」への遷移はできません`,
          });
          continue;
        }

        await prisma.invoiceGroup.update({
          where: { id: item.groupId },
          data: {
            status: newStatus,
            ...(newStatus === "paid" && !group.actualPaymentDate ? {
              actualPaymentDate: group.expectedPaymentDate ?? new Date(toLocalDateString(new Date()))
            } : {}),
          },
        });
        result.success.push(item);

      } else {
        const group = await prisma.paymentGroup.findFirst({
          where: { id: item.groupId, deletedAt: null },
        });
        if (!group) {
          result.skipped.push({ ...item, reason: "支払管理レコードが見つかりません" });
          continue;
        }

        const validNextStatuses = paymentValidTransitions[group.status] ?? [];
        if (!validNextStatuses.includes(newStatus)) {
          result.skipped.push({
            ...item,
            reason: `ステータス「${group.status}」から「${newStatus}」への遷移はできません`,
          });
          continue;
        }

        await prisma.paymentGroup.update({
          where: { id: item.groupId },
          data: {
            status: newStatus,
            ...(newStatus === "paid" && !group.actualPaymentDate ? {
              actualPaymentDate: group.expectedPaymentDate ?? new Date(toLocalDateString(new Date()))
            } : {}),
          },
        });
        result.success.push(item);
      }
    } catch (e) {
      result.skipped.push({
        ...item,
        reason: e instanceof Error ? e.message : "不明なエラー",
      });
    }
  }

  revalidatePath("/stp/finance/invoices");
  revalidatePath("/stp/finance/payment-groups");
  revalidatePath("/accounting/transactions");

  return result;
}
