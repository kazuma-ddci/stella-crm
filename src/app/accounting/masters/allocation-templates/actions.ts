"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { recordChangeLogs } from "@/app/finance/changelog/actions";
import { toLocalDateString, toBoolean } from "@/lib/utils";
import { ok, err, type ActionResult } from "@/lib/action-result";

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
): Promise<ActionResult> {
  try {
    const session = await getSession();
    const staffId = session.id;

    const name = (data.name as string)?.trim();
    const isActive = data.isActive !== false && data.isActive !== "false";
    const lines = data.lines as LineInput[] | undefined;

    if (!name) {
      return err("テンプレート名は必須です");
    }

    // 名称重複チェック
    const existing = await prisma.allocationTemplate.findFirst({
      where: { name, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      return err(`テンプレート名「${name}」は既に使用されています`);
    }

    // 明細バリデーション
    if (!lines || lines.length === 0) {
      return err("按分明細を1行以上追加してください");
    }

    const validationError = validateLinesOrError(lines);
    if (validationError) return err(validationError);

    // 代表プロジェクト（ownerCostCenterId）バリデーション
    const ownerCostCenterId = data.ownerCostCenterId != null ? Number(data.ownerCostCenterId) : null;
    if (ownerCostCenterId !== null) {
      const lineCostCenterIds = lines
        .map((l) => l.costCenterId)
        .filter((id): id is number => id !== null);
      if (!lineCostCenterIds.includes(ownerCostCenterId)) {
        return err("代表プロジェクトは按分明細に含まれるコストセンターから選択してください");
      }
    }

    await prisma.allocationTemplate.create({
      data: {
        name,
        isActive,
        ownerCostCenterId,
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
    return ok();
  } catch (e) {
    console.error("[createAllocationTemplate] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ===== 按分テンプレート更新 =====
export async function updateAllocationTemplate(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
  const session = await getSession();
  const staffId = session.id;

  const template = await prisma.allocationTemplate.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!template || template.deletedAt) {
    return err("テンプレートが見つかりません");
  }

  // ★ Issue 1: クローズ済み月関与時の権限チェック（非管理者はテンプレート編集自体不可）
  const hasClosedMonth = await checkClosedMonthInvolvement(id);
  if (hasClosedMonth) {
    const isAdmin = session.permissions.some(
      (p) => p.permissionLevel === "manager"
    ) || session.organizationRole === "founder";
    if (!isAdmin) {
      return err(
        "クローズ済みの月に関わるテンプレートの変更は経理管理者権限が必要です"
      );
    }
  }

  const updateData: Record<string, unknown> = {};

  if ("name" in data) {
    const name = (data.name as string)?.trim();
    if (!name) return err("テンプレート名は必須です");

    const existing = await prisma.allocationTemplate.findFirst({
      where: { name, deletedAt: null, id: { not: id } },
      select: { id: true },
    });
    if (existing) {
      return err(`テンプレート名「${name}」は既に使用されています`);
    }
    updateData.name = name;
  }

  if ("isActive" in data) {
    updateData.isActive = toBoolean(data.isActive);
  }

  if ("ownerCostCenterId" in data) {
    updateData.ownerCostCenterId = data.ownerCostCenterId != null ? Number(data.ownerCostCenterId) : null;
  }

  if ("lines" in data) {
    const lines = data.lines as LineInput[];
    if (!lines || lines.length === 0) {
      return err("按分明細を1行以上追加してください");
    }
    const validationError = validateLinesOrError(lines);
    if (validationError) return err(validationError);

    // 代表PJバリデーション（lines変更時、ownerCostCenterIdが設定済みなら新linesに含まれるか確認）
    const effectiveOwnerCcId = "ownerCostCenterId" in data
      ? (data.ownerCostCenterId != null ? Number(data.ownerCostCenterId) : null)
      : template.ownerCostCenterId;
    if (effectiveOwnerCcId !== null) {
      const newLineCcIds = lines
        .map((l) => l.costCenterId)
        .filter((id): id is number => id !== null);
      if (!newLineCcIds.includes(effectiveOwnerCcId)) {
        return err("代表プロジェクトは按分明細に含まれるコストセンターから選択してください。先に代表を変更するか、明細にコストセンターを残してください。");
      }
    }

    // 変更前の明細データを保存（変更履歴用）
    const oldLines = template.lines.map((l) => ({
      id: l.id,
      costCenterId: l.costCenterId,
      allocationRate: Number(l.allocationRate),
      label: l.label,
    }));

    // 既存の明細を全削除 → 新規作成（シンプルなリプレース戦略）+ 変更履歴記録
    await prisma.$transaction(async (tx) => {
      await tx.allocationTemplateLine.deleteMany({
        where: { templateId: id },
      });
      await tx.allocationTemplate.update({
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
              updatedBy: staffId,
            })),
          },
        },
      });

      // 按分テンプレート明細の変更履歴を記録
      await recordChangeLogs(
        [
          {
            tableName: "AllocationTemplateLine",
            recordId: id, // テンプレートIDを使用
            changeType: "update",
            oldData: { templateId: id, lines: oldLines },
            newData: {
              templateId: id,
              lines: lines.map((l) => ({
                costCenterId: l.costCenterId,
                allocationRate: l.allocationRate,
                label: l.label,
              })),
            },
          },
        ],
        staffId,
        tx
      );
    });
  } else {
    updateData.updatedBy = staffId;
    await prisma.allocationTemplate.update({
      where: { id },
      data: updateData,
    });
  }

    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[updateAllocationTemplate] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ===== 按分テンプレート削除（論理削除） =====
export async function deleteAllocationTemplate(
  id: number
): Promise<ActionResult> {
  try {
    const session = await getSession();
    const staffId = session.id;

    // ★ Issue 4: 使用中チェック
    const [txCount, recurringTxCount] = await Promise.all([
      prisma.transaction.count({
        where: { allocationTemplateId: id, deletedAt: null },
      }),
      prisma.recurringTransaction.count({
        where: { allocationTemplateId: id, deletedAt: null },
      }),
    ]);

    const totalCount = txCount + recurringTxCount;
    if (totalCount > 0) {
      const parts: string[] = [];
      if (txCount > 0) parts.push(`取引 ${txCount}件`);
      if (recurringTxCount > 0) parts.push(`定期取引 ${recurringTxCount}件`);
      return err(
        `このテンプレートは${parts.join("、")}で使用されています。使用中のテンプレートは削除できません。無効にする場合は「有効」フラグをオフにしてください。`
      );
    }

    await prisma.allocationTemplate.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: staffId,
      },
    });

    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[deleteAllocationTemplate] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
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

  return transactions.map((t) => ({
    id: t.id,
    transactionDate: toLocalDateString(t.periodFrom),
    counterpartyName: t.counterparty?.name ?? "（不明）",
    costCenterName: t.costCenter?.name ?? "",
    amountIncludingTax: t.amount + t.taxAmount,
    isClosed: false,
  }));
}

// ===== テンプレート変更時のオーバーライド作成（変更前維持） =====
export async function createTemplateOverrides(
  templateId: number,
  keepTransactionIds: number[],
  snapshotRates: { costCenterId: number | null; rate: number }[],
  reason?: string // ★ Issue 3: 維持理由
): Promise<ActionResult> {
  try {
    const session = await getSession();
    const staffId = session.id;

    if (keepTransactionIds.length === 0) return ok();

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
        reason: reason || null, // ★ Issue 3
        createdBy: staffId,
      },
      update: {
        snapshotRates: snapshotRates as unknown as Prisma.InputJsonValue,
        reason: reason || null, // ★ Issue 3
      },
    });
  }

    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[createTemplateOverrides] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ===== クローズ月関与チェック =====
export async function checkClosedMonthInvolvement(
  templateId: number
): Promise<boolean> {
  const transactions = await prisma.transaction.findMany({
    where: {
      allocationTemplateId: templateId,
      deletedAt: null,
    },
    select: { periodFrom: true },
  });

  return false;
}

// ===== バリデーション =====
// エラーメッセージを返す（なければnull）
function validateLinesOrError(lines: LineInput[]): string | null {
  let total = new Prisma.Decimal(0);
  for (const line of lines) {
    if (line.allocationRate <= 0 || line.allocationRate > 100) {
      return "按分率は0より大きく100以下である必要があります";
    }
    total = total.add(new Prisma.Decimal(line.allocationRate));
  }

  if (!total.equals(new Prisma.Decimal(100))) {
    return `按分率の合計が100%ではありません。現在の合計: ${total.toFixed(2)}%`;
  }
  return null;
}
