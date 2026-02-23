"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Prisma } from "@prisma/client";

const REVALIDATE_PATH = "/accounting/transactions";

// ===== 按分金額計算（端数処理: 1円未満切り捨て、差額は最後の按分先に寄せる） =====
export function calculateAllocatedAmounts(
  amountIncludingTax: number,
  lines: { costCenterId: number | null; allocationRate: Prisma.Decimal }[]
): { costCenterId: number | null; amount: number; allocationRate: number }[] {
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
): Promise<AllocationStatusResult | null> {
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
    throw new Error("取引が見つかりません");
  }

  if (!transaction.allocationTemplateId || !transaction.allocationTemplate) {
    return null; // 按分なし
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
  const allocatedAmounts = calculateAllocatedAmounts(
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

  return {
    transactionId,
    transactionStatus: transaction.status,
    amountIncludingTax,
    totalRequired,
    confirmed: totalConfirmed,
    pending: totalRequired - totalConfirmed,
    isFullyConfirmed: totalConfirmed === totalRequired,
    confirmations,
  };
}

// ===== 按分確定 =====
export async function confirmAllocation(
  transactionId: number,
  costCenterId: number
) {
  const session = await getSession();
  const staffId = session.id;

  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, deletedAt: null },
    include: {
      allocationTemplate: {
        include: { lines: true },
      },
    },
  });

  if (!transaction) {
    throw new Error("取引が見つかりません");
  }

  if (!transaction.allocationTemplateId || !transaction.allocationTemplate) {
    throw new Error("この取引には按分テンプレートが設定されていません");
  }

  // 指定されたcostCenterIdがテンプレート内に存在するか
  const templateLine = transaction.allocationTemplate.lines.find(
    (l) => l.costCenterId === costCenterId
  );
  if (!templateLine) {
    throw new Error("指定された按分先はテンプレートに含まれていません");
  }

  // AllocationConfirmation を作成（重複は@@uniqueで防止）
  try {
    await prisma.allocationConfirmation.create({
      data: {
        transactionId,
        costCenterId,
        confirmedBy: staffId,
        confirmedAt: new Date(),
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw new Error("この按分先は既に確定済みです");
    }
    throw e;
  }

  // 全プロジェクト確定チェック → 経理引き渡し
  await checkAndTransitionToAwaitingAccounting(transactionId);

  revalidatePath(REVALIDATE_PATH);
  revalidatePath("/accounting/dashboard");
}

// ===== 全プロジェクト確定チェック → 経理引き渡し =====
async function checkAndTransitionToAwaitingAccounting(transactionId: number) {
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
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: "awaiting_accounting",
      },
    });
  }
}

// ===== 取引作成時の自動按分確定（作成者プロジェクトのコストセンター） =====
export async function autoConfirmCreatorAllocations(
  transactionId: number,
  projectId: number | null,
  staffId: number,
  tx: Prisma.TransactionClient
) {
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

  if (!transaction?.allocationTemplate) return;

  // 作成者のプロジェクトに紐づくコストセンターを見つける
  const creatorCostCenterLines = transaction.allocationTemplate.lines.filter(
    (l) =>
      l.costCenterId !== null &&
      l.costCenter &&
      l.costCenter.projectId === projectId &&
      projectId !== null
  );

  for (const line of creatorCostCenterLines) {
    await tx.allocationConfirmation.create({
      data: {
        transactionId,
        costCenterId: line.costCenterId!,
        confirmedBy: staffId,
        confirmedAt: new Date(),
      },
    });
  }
}
