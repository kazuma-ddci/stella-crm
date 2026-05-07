"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createNotificationBulk } from "@/lib/notifications/create-notification";
import { recordChangeLog } from "@/app/finance/changelog/actions";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireFinanceTransactionAccess } from "@/lib/auth/finance-access";

const REVALIDATE_PATH = "/accounting/transactions";

// ===== 按分金額計算（端数処理: 1円未満切り捨て、差額は最後の按分先に寄せる） =====
export async function calculateAllocatedAmounts(
  amountIncludingTax: number,
  lines: { costCenterId: number | null; allocationRate: Prisma.Decimal }[]
): Promise<{ costCenterId: number | null; amount: number; allocationRate: number }[]> {
  // 確定枠のみ（costCenterId != null）
  const confirmedLines = lines.filter((l) => l.costCenterId !== null);
  if (confirmedLines.length === 0) return [];

  const results: {
    costCenterId: number | null;
    amount: number;
    allocationRate: number;
  }[] = [];
  let totalAllocated = 0;

  for (const line of confirmedLines) {
    const rate = Number(line.allocationRate);
    const allocated = Math.floor((amountIncludingTax * rate) / 100);
    totalAllocated += allocated;
    results.push({
      costCenterId: line.costCenterId,
      amount: allocated,
      allocationRate: rate,
    });
  }

  // 端数を最後の按分先に寄せる
  const remainder = amountIncludingTax - totalAllocated;
  if (remainder > 0 && results.length > 0) {
    results[results.length - 1].amount += remainder;
  }

  return results;
}

// ===== 按分確定状況を取得 =====
export type AllocationStatusResult = {
  transactionId: number;
  transactionStatus: string;
  amountIncludingTax: number;
  totalRequired: number;
  confirmed: number;
  pending: number;
  isFullyConfirmed: boolean;
  confirmations: {
    costCenterId: number;
    costCenterName: string;
    allocationRate: number;
    allocatedAmount: number;
    status: "confirmed" | "pending";
    confirmedBy: { id: number; name: string } | null;
    confirmedAt: Date | null;
  }[];
};

export async function getAllocationStatus(
  transactionId: number
): Promise<ActionResult<AllocationStatusResult | null>> {
  // 注: per-record helper の redirect を伝播させるため try/catch の外で呼ぶ
  await requireFinanceTransactionAccess(transactionId, "view");
  try {
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, deletedAt: null },
    include: {
      allocationTemplate: {
        include: {
          lines: {
            include: {
              costCenter: { select: { id: true, name: true } },
            },
          },
        },
      },
      allocationConfirmations: {
        include: {
          confirmer: { select: { id: true, name: true } },
        },
      },
      allocationOverrides: true,
    },
  });

  if (!transaction) {
    return err("取引が見つかりません");
  }

  if (!transaction.allocationTemplateId || !transaction.allocationTemplate) {
    return ok(null); // 按分なし
  }

  const amountIncludingTax = transaction.amount + transaction.taxAmount;

  // オーバーライドがある場合はそちらの按分率を使用
  const override = transaction.allocationOverrides[0];
  let effectiveLines: {
    costCenterId: number | null;
    allocationRate: Prisma.Decimal;
    label: string | null;
    costCenter: { id: number; name: string } | null;
  }[];

  if (override) {
    const snapshotRates = override.snapshotRates as {
      costCenterId: number | null;
      rate: number;
    }[];
    effectiveLines = transaction.allocationTemplate.lines.map((l) => {
      const snapshot = snapshotRates.find(
        (s) => s.costCenterId === l.costCenterId
      );
      return {
        costCenterId: l.costCenterId,
        allocationRate: snapshot
          ? new Prisma.Decimal(snapshot.rate)
          : l.allocationRate,
        label: l.label,
        costCenter: l.costCenter,
      };
    });
  } else {
    effectiveLines = transaction.allocationTemplate.lines;
  }

  // 確定枠のみ（costCenterId != null）
  const confirmedLinesList = effectiveLines.filter(
    (l) => l.costCenterId !== null
  );

  // 按分金額計算
  const allocatedAmounts = await calculateAllocatedAmounts(
    amountIncludingTax,
    confirmedLinesList.map((l) => ({
      costCenterId: l.costCenterId,
      allocationRate: l.allocationRate,
    }))
  );

  // 確定状況マップ
  const confirmationMap = new Map(
    transaction.allocationConfirmations.map((ac) => [ac.costCenterId, ac])
  );

  const confirmations = confirmedLinesList.map((line) => {
    const confirmation = confirmationMap.get(line.costCenterId!);
    const allocated = allocatedAmounts.find(
      (a) => a.costCenterId === line.costCenterId
    );
    return {
      costCenterId: line.costCenterId!,
      costCenterName: line.costCenter?.name ?? "不明",
      allocationRate: Number(line.allocationRate),
      allocatedAmount: allocated?.amount ?? 0,
      status: (confirmation ? "confirmed" : "pending") as
        | "confirmed"
        | "pending",
      confirmedBy: confirmation?.confirmer ?? null,
      confirmedAt: confirmation?.confirmedAt ?? null,
    };
  });

  const totalConfirmed = confirmations.filter(
    (c) => c.status === "confirmed"
  ).length;
  const totalRequired = confirmations.length;

  return ok({
    transactionId,
    transactionStatus: transaction.status,
    amountIncludingTax,
    totalRequired,
    confirmed: totalConfirmed,
    pending: totalRequired - totalConfirmed,
    isFullyConfirmed: totalConfirmed === totalRequired,
    confirmations,
  });
  } catch (e) {
    console.error("[getAllocationStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ===== 按分確定 =====
export async function confirmAllocation(
  transactionId: number,
  costCenterId: number
): Promise<ActionResult> {
  try {
    const { user } = await requireFinanceTransactionAccess(transactionId, "edit");
    const staffId = user.id;

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, deletedAt: null },
      include: {
        allocationTemplate: {
          include: { lines: true },
        },
      },
    });

    if (!transaction) {
      return err("取引が見つかりません");
    }

    if (!transaction.allocationTemplateId || !transaction.allocationTemplate) {
      return err("この取引には按分テンプレートが設定されていません");
    }

    // 按分確定可能なステータスかチェック
    const confirmableStatuses = ["unconfirmed", "confirmed"];
    if (!confirmableStatuses.includes(transaction.status)) {
      return err(
        `ステータス「${transaction.status}」の取引は按分確定できません`
      );
    }

    // 指定されたcostCenterIdがテンプレート内に存在するか
    const templateLine = transaction.allocationTemplate.lines.find(
      (l) => l.costCenterId === costCenterId
    );
    if (!templateLine) {
      return err("指定された按分先はテンプレートに含まれていません");
    }

    // AllocationConfirmation を作成（重複は@@uniqueで防止）
    try {
      const confirmation = await prisma.allocationConfirmation.create({
        data: {
          transactionId,
          costCenterId,
          confirmedBy: staffId,
          confirmedAt: new Date(),
        },
      });

      await recordChangeLog(
        {
          tableName: "AllocationConfirmation",
          recordId: confirmation.id,
          changeType: "create",
          newData: { transactionId, costCenterId },
        },
        staffId
      );
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return err("この按分先は既に確定済みです");
      }
      throw e;
    }

    // 全プロジェクト確定チェック → 経理引き渡し
    await checkAndTransitionToAwaitingAccounting(transactionId);

    // 経理側 + 事業PJ側（STP）両方のキャッシュを無効化
    // 按分確定は請求グループ/支払グループ詳細 + 経理ワークフロー両方の表示に影響
    revalidatePath(REVALIDATE_PATH);
    revalidatePath("/accounting/workflow");
    revalidatePath("/stp/finance/invoices");
    revalidatePath("/stp/finance/payment-groups");
    revalidatePath("/stp/finance/transactions");
    return ok();
  } catch (e) {
    console.error("[confirmAllocation] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ===== 全プロジェクト確定チェック → 経理引き渡し =====
export async function checkAndTransitionToAwaitingAccounting(transactionId: number) {
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, deletedAt: null },
    include: {
      allocationTemplate: {
        include: { lines: true },
      },
      allocationConfirmations: true,
    },
  });

  if (!transaction || !transaction.allocationTemplate) return;

  // 確定枠の数（costCenterId != null）
  const requiredCostCenterIds = transaction.allocationTemplate.lines
    .filter((l) => l.costCenterId !== null)
    .map((l) => l.costCenterId!);

  if (requiredCostCenterIds.length === 0) return;

  // 確定済みのコストセンターID
  const confirmedCostCenterIds = new Set(
    transaction.allocationConfirmations.map((ac) => ac.costCenterId)
  );

  const allConfirmed = requiredCostCenterIds.every((id) =>
    confirmedCostCenterIds.has(id)
  );

  // 全確定 かつ ステータスが confirmed の場合のみ自動遷移
  if (allConfirmed && transaction.status === "confirmed") {
    // 最後に確定した人のIDを取得
    const latestConfirmation = transaction.allocationConfirmations
      .sort((a, b) => (b.confirmedAt?.getTime() ?? 0) - (a.confirmedAt?.getTime() ?? 0))[0];
    const updatedBy = latestConfirmation?.confirmedBy ?? null;

    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: "awaiting_accounting",
          updatedBy,
        },
      });

      if (updatedBy) {
        await recordChangeLog(
          {
            tableName: "Transaction",
            recordId: transactionId,
            changeType: "update",
            oldData: { status: "confirmed" },
            newData: { status: "awaiting_accounting" },
          },
          updatedBy,
          tx
        );
      }
    });
  }
}

// ===== 按分確定依頼の通知対象情報 =====
export type AllocationNotificationInfo = {
  recipientIds: number[];
  senderId: number;
  transactionId: number;
};

// ===== 取引作成時の自動按分確定（作成者プロジェクトのコストセンター） =====
// 戻り値: 他プロジェクトへの通知対象情報（トランザクション完了後に通知送信用）
export async function autoConfirmCreatorAllocations(
  transactionId: number,
  projectId: number | null,
  staffId: number,
  tx: Prisma.TransactionClient
): Promise<AllocationNotificationInfo | null> {
  const transaction = await tx.transaction.findFirst({
    where: { id: transactionId },
    include: {
      allocationTemplate: {
        include: {
          lines: {
            include: {
              costCenter: { select: { id: true, projectId: true } },
            },
          },
        },
      },
    },
  });

  if (!transaction?.allocationTemplate) return null;

  // 作成者のプロジェクトに紐づくコストセンターを見つける
  const creatorCostCenterLines = transaction.allocationTemplate.lines.filter(
    (l) =>
      l.costCenterId !== null &&
      l.costCenter &&
      l.costCenter.projectId === projectId &&
      projectId !== null
  );

  for (const line of creatorCostCenterLines) {
    const confirmation = await tx.allocationConfirmation.create({
      data: {
        transactionId,
        costCenterId: line.costCenterId!,
        confirmedBy: staffId,
        confirmedAt: new Date(),
      },
    });

    await recordChangeLog(
      {
        tableName: "AllocationConfirmation",
        recordId: confirmation.id,
        changeType: "create",
        newData: { transactionId, costCenterId: line.costCenterId },
      },
      staffId,
      tx
    );
  }

  // 自動確定されなかったコストセンター（他プロジェクト）に対して按分確定依頼の通知対象を収集
  const unconfirmedLines = transaction.allocationTemplate.lines.filter(
    (l) =>
      l.costCenterId !== null &&
      l.costCenter &&
      (l.costCenter.projectId !== projectId || projectId === null)
  );

  if (unconfirmedLines.length === 0) return null;

  // 他プロジェクトIDを一意に取得
  const otherProjectIds = [
    ...new Set(
      unconfirmedLines
        .map((l) => l.costCenter!.projectId)
        .filter((pid): pid is number => pid !== null)
    ),
  ];

  if (otherProjectIds.length === 0) return null;

  // 各プロジェクトのedit以上の権限を持つスタッフを取得
  const permissions = await tx.staffPermission.findMany({
    where: {
      projectId: { in: otherProjectIds },
      permissionLevel: { in: ["edit", "manager"] },
      staffId: { not: staffId },
    },
    select: { staffId: true },
  });

  const recipientIds = [...new Set(permissions.map((p) => p.staffId))];

  if (recipientIds.length === 0) return null;

  return { recipientIds, senderId: staffId, transactionId };
}

/**
 * 按分確定依頼の通知を送信する。
 * autoConfirmCreatorAllocations のトランザクション完了後に呼び出す。
 */
export async function sendAllocationNotifications(
  info: AllocationNotificationInfo
): Promise<void> {
  await createNotificationBulk(info.recipientIds, {
    senderType: "staff",
    senderId: info.senderId,
    category: "accounting",
    title: "按分確定依頼",
    message: `取引ID: ${info.transactionId} の按分確定を依頼されています。ご確認ください。`,
    linkUrl: "/accounting/transactions",
  });
}
