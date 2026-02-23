"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Prisma } from "@prisma/client";

const REVALIDATE_PATH = "/accounting/masters/allocation-templates";

type LineInput = {
  id?: number;
  costCenterId: number | null;
  allocationRate: number;
  label: string | null;
};

// ===== 按分テンプレート作成 =====
export async function createAllocationTemplate(
  data: Record<string, unknown>
) {
  const session = await getSession();
  const staffId = session.id;

  const name = (data.name as string)?.trim();
  const isActive = data.isActive !== false && data.isActive !== "false";
  const lines = data.lines as LineInput[] | undefined;

  if (!name) {
    throw new Error("テンプレート名は必須です");
  }

  // 名称重複チェック
  const existing = await prisma.allocationTemplate.findFirst({
    where: { name, deletedAt: null },
    select: { id: true },
  });
  if (existing) {
    throw new Error(`テンプレート名「${name}」は既に使用されています`);
  }

  // 明細バリデーション
  if (!lines || lines.length === 0) {
    throw new Error("按分明細を1行以上追加してください");
  }

  validateLines(lines);

  await prisma.allocationTemplate.create({
    data: {
      name,
      isActive,
      createdBy: staffId,
      lines: {
        create: lines.map((line) => ({
          costCenterId: line.costCenterId,
          allocationRate: new Prisma.Decimal(line.allocationRate),
          label: line.label || null,
          createdBy: staffId,
        })),
      },
    },
  });

  revalidatePath(REVALIDATE_PATH);
}

// ===== 按分テンプレート更新 =====
export async function updateAllocationTemplate(
  id: number,
  data: Record<string, unknown>
) {
  const session = await getSession();
  const staffId = session.id;

  const template = await prisma.allocationTemplate.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!template || template.deletedAt) {
    throw new Error("テンプレートが見つかりません");
  }

  const updateData: Record<string, unknown> = {};

  if ("name" in data) {
    const name = (data.name as string)?.trim();
    if (!name) throw new Error("テンプレート名は必須です");

    const existing = await prisma.allocationTemplate.findFirst({
      where: { name, deletedAt: null, id: { not: id } },
      select: { id: true },
    });
    if (existing) {
      throw new Error(`テンプレート名「${name}」は既に使用されています`);
    }
    updateData.name = name;
  }

  if ("isActive" in data) {
    updateData.isActive = data.isActive === true || data.isActive === "true";
  }

  if ("lines" in data) {
    const lines = data.lines as LineInput[];
    if (!lines || lines.length === 0) {
      throw new Error("按分明細を1行以上追加してください");
    }
    validateLines(lines);

    // 既存の明細を全削除 → 新規作成（シンプルなリプレース戦略）
    await prisma.$transaction([
      prisma.allocationTemplateLine.deleteMany({
        where: { templateId: id },
      }),
      prisma.allocationTemplate.update({
        where: { id },
        data: {
          ...updateData,
          updatedBy: staffId,
          lines: {
            create: lines.map((line) => ({
              costCenterId: line.costCenterId,
              allocationRate: new Prisma.Decimal(line.allocationRate),
              label: line.label || null,
              createdBy: staffId,
            })),
          },
        },
      }),
    ]);
  } else {
    updateData.updatedBy = staffId;
    await prisma.allocationTemplate.update({
      where: { id },
      data: updateData,
    });
  }

  revalidatePath(REVALIDATE_PATH);
}

// ===== 按分テンプレート削除（論理削除） =====
export async function deleteAllocationTemplate(id: number) {
  const session = await getSession();
  const staffId = session.id;

  await prisma.allocationTemplate.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      updatedBy: staffId,
    },
  });

  revalidatePath(REVALIDATE_PATH);
}

// ===== 影響する取引を取得 =====
export async function getAffectedTransactions(templateId: number) {
  const transactions = await prisma.transaction.findMany({
    where: {
      allocationTemplateId: templateId,
      deletedAt: null,
    },
    include: {
      counterparty: { select: { name: true } },
      costCenter: { select: { name: true } },
    },
    orderBy: { periodFrom: "desc" },
  });

  // 取引が属する月次のクローズ状態を取得
  const transactionMonths = new Set<string>();
  for (const t of transactions) {
    const d = new Date(t.periodFrom);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    transactionMonths.add(monthStart.toISOString());
  }

  const closedMonths = new Set<string>();
  if (transactionMonths.size > 0) {
    const monthDates = Array.from(transactionMonths).map((m) => new Date(m));
    const closeRecords = await prisma.accountingMonthlyClose.findMany({
      where: {
        targetMonth: { in: monthDates },
        status: { not: "open" },
      },
      select: { targetMonth: true },
    });
    for (const r of closeRecords) {
      closedMonths.add(new Date(r.targetMonth).toISOString());
    }
  }

  return transactions.map((t) => {
    const d = new Date(t.periodFrom);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const isClosed = closedMonths.has(monthStart.toISOString());
    return {
      id: t.id,
      transactionDate: t.periodFrom.toISOString().split("T")[0],
      counterpartyName: t.counterparty?.name ?? "（不明）",
      costCenterName: t.costCenter?.name ?? "",
      amountIncludingTax: t.amount + t.taxAmount,
      isClosed,
    };
  });
}

// ===== テンプレート変更時のオーバーライド作成（変更前維持） =====
export async function createTemplateOverrides(
  templateId: number,
  keepTransactionIds: number[],
  snapshotRates: { costCenterId: number | null; rate: number }[]
) {
  const session = await getSession();
  const staffId = session.id;

  if (keepTransactionIds.length === 0) return;

  // 既存のオーバーライドがある場合は更新、なければ新規作成
  for (const txId of keepTransactionIds) {
    await prisma.allocationTemplateOverride.upsert({
      where: {
        transactionId_allocationTemplateId: {
          transactionId: txId,
          allocationTemplateId: templateId,
        },
      },
      create: {
        transactionId: txId,
        allocationTemplateId: templateId,
        snapshotRates: snapshotRates as unknown as Prisma.InputJsonValue,
        createdBy: staffId,
      },
      update: {
        snapshotRates: snapshotRates as unknown as Prisma.InputJsonValue,
      },
    });
  }

  revalidatePath(REVALIDATE_PATH);
}

// ===== クローズ月関与チェック =====
export async function checkClosedMonthInvolvement(templateId: number): Promise<boolean> {
  const transactions = await prisma.transaction.findMany({
    where: {
      allocationTemplateId: templateId,
      deletedAt: null,
    },
    select: { periodFrom: true },
  });

  if (transactions.length === 0) return false;

  const monthDates = new Set<string>();
  for (const t of transactions) {
    const d = new Date(t.periodFrom);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    monthDates.add(monthStart.toISOString());
  }

  const closedCount = await prisma.accountingMonthlyClose.count({
    where: {
      targetMonth: { in: Array.from(monthDates).map((m) => new Date(m)) },
      status: { not: "open" },
    },
  });

  return closedCount > 0;
}

// ===== バリデーション =====
function validateLines(lines: LineInput[]) {
  let total = new Prisma.Decimal(0);
  for (const line of lines) {
    if (line.allocationRate <= 0 || line.allocationRate > 100) {
      throw new Error("按分率は0より大きく100以下である必要があります");
    }
    total = total.add(new Prisma.Decimal(line.allocationRate));
  }

  if (!total.equals(new Prisma.Decimal(100))) {
    throw new Error(
      `按分率の合計が100%ではありません。現在の合計: ${total.toFixed(2)}%`
    );
  }
}
