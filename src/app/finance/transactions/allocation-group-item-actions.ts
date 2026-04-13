"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { recordChangeLog } from "@/app/finance/changelog/actions";
import { calculateAllocatedAmounts } from "./allocation-actions";
import { toLocalDateString } from "@/lib/utils";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffForFinance } from "@/lib/auth/staff-action";
import {
  requireFinanceTransactionAccess,
  requireFinanceInvoiceGroupAccess,
  requireFinancePaymentGroupAccess,
  requireFinanceProjectAccess,
  FinanceRecordNotFoundError,
  FinanceForbiddenError,
} from "@/lib/auth/finance-access";

// ===== 共通定数・スキーマ =====

const GROUP_TYPES = ["invoice", "payment"] as const;
const groupTypeSchema = z.enum(GROUP_TYPES);
type GroupType = z.infer<typeof groupTypeSchema>;

/** prisma.$transaction() コールバックのクライアント型 */
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ===== 型定義 =====

export type AllocationGroupItemResult = {
  id: number;
  transactionId: number;
  costCenterId: number;
  costCenterName: string;
  groupType: "invoice" | "payment";
  allocatedAmount: number;
  allocatedTaxAmount: number;
  invoiceGroupId: number | null;
  paymentGroupId: number | null;
  groupStatus: string | null;
  groupLabel: string | null; // 請求書番号 or 対象月
};

export type AllocationGroupStatus = {
  transactionId: number;
  transactionType: string;
  amountIncludingTax: number;
  ownerCostCenterId: number | null;
  ownerCostCenterName: string | null;
  items: {
    costCenterId: number;
    costCenterName: string;
    allocationRate: number;
    allocatedAmount: number;
    allocatedTaxAmount: number;
    isProcessed: boolean; // AllocationGroupItemが存在するか
    groupItem: AllocationGroupItemResult | null;
  }[];
};

// ===== 按分取引をグループに追加 =====

export async function addAllocationItemToGroup(
  transactionId: number,
  costCenterId: number,
  groupType: "invoice" | "payment",
  groupId: number
): Promise<ActionResult<{ warnings: string[] }>> {
  try {
  // P2: groupType のランタイム検証
  groupTypeSchema.parse(groupType);

  // per-record 認可: 取引 + グループ両方へのアクセス権を確認
  const { user } = await requireFinanceTransactionAccess(transactionId, "edit");
  if (groupType === "invoice") {
    await requireFinanceInvoiceGroupAccess(groupId, "edit");
  } else {
    await requireFinancePaymentGroupAccess(groupId, "edit");
  }

  const staffId = user.id;
  const warnings: string[] = [];

  // 1. 取引の存在確認 + 按分テンプレート確認
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
      allocationConfirmations: true,
    },
  });

  if (!transaction) {
    return err("取引が見つかりません");
  }

  if (!transaction.allocationTemplateId || !transaction.allocationTemplate) {
    return err("この取引には按分テンプレートが設定されていません");
  }

  // 2. groupType と transaction.type の整合性
  if (transaction.type === "revenue" && groupType !== "invoice") {
    return err("売上取引は請求管理（invoice）にのみ追加できます");
  }
  if (transaction.type === "expense" && groupType !== "payment") {
    return err("経費取引は支払管理（payment）にのみ追加できます");
  }

  // P1-1: direct FK 所属との二重計上防止
  if (transaction.type === "revenue" && transaction.invoiceGroupId !== null) {
    return err(
      "この按分取引は既に請求に直接所属しています。按分明細として追加する必要はありません。"
    );
  }
  if (transaction.type === "expense" && transaction.paymentGroupId !== null) {
    return err(
      "この按分取引は既に支払に直接所属しています。按分明細として追加する必要はありません。"
    );
  }

  // 3. 対象CostCenterがテンプレートのlinesに存在するか
  const templateLine = transaction.allocationTemplate.lines.find(
    (l) => l.costCenterId === costCenterId
  );
  if (!templateLine) {
    return err("指定されたコストセンターは按分テンプレートの明細に含まれていません");
  }

  // 4. 対象CostCenterのAllocationConfirmationが完了済みか
  const isConfirmed = transaction.allocationConfirmations.some(
    (ac) => ac.costCenterId === costCenterId
  );
  if (!isConfirmed) {
    return err("このコストセンターの按分確定が完了していません。先に按分確定を行ってください。");
  }

  // 5. グループのステータス確認
  if (groupType === "invoice") {
    const group = await prisma.invoiceGroup.findFirst({
      where: { id: groupId, deletedAt: null },
    });
    if (!group) return err("請求管理レコードが見つかりません");
    if (!["draft", "pdf_created"].includes(group.status)) {
      return err(`ステータス「${group.status}」の請求管理レコードには追加できません`);
    }
  } else {
    const group = await prisma.paymentGroup.findFirst({
      where: { id: groupId, deletedAt: null },
    });
    if (!group) return err("支払管理レコードが見つかりません");
    if (!["before_request", "rejected"].includes(group.status)) {
      return err(`ステータス「${group.status}」の支払管理レコードには追加できません`);
    }
  }

  // 6. 重複チェック（サーバー側で事前チェック）
  const existing = await prisma.allocationGroupItem.findUnique({
    where: {
      transactionId_costCenterId_groupType: {
        transactionId,
        costCenterId,
        groupType,
      },
    },
  });
  if (existing) {
    return err("このコストセンター分は既に別の請求・支払に追加されています");
  }

  // 7. 代表PJ以外からの追加時の警告
  const ownerCostCenterId = transaction.allocationTemplate.ownerCostCenterId;
  if (ownerCostCenterId !== null && ownerCostCenterId !== costCenterId) {
    const ownerCcName = transaction.allocationTemplate.lines.find(
      (l) => l.costCenterId === ownerCostCenterId
    )?.costCenter?.name ?? "不明";
    warnings.push(
      `この取引の代表プロジェクトは「${ownerCcName}」です。代表側で先に処理することを推奨します。`
    );
  }

  // 8. 按分金額の計算（端数寄せ付き）
  const templateLines = transaction.allocationTemplate.lines.map((l) => ({
    costCenterId: l.costCenterId,
    allocationRate: l.allocationRate,
  }));
  const amountIncludingTax = transaction.amount + transaction.taxAmount;
  const allocatedAmounts = await calculateAllocatedAmounts(
    amountIncludingTax,
    templateLines
  );

  const allocated = allocatedAmounts.find((a) => a.costCenterId === costCenterId);
  if (!allocated) {
    return err("按分金額の計算に失敗しました");
  }

  // P1-2: 税額按分も端数寄せ付きで計算（金額と同じ remainder-to-last 方式）
  const allocatedTaxAmounts = await calculateAllocatedAmounts(
    transaction.taxAmount,
    templateLines
  );
  const allocatedTax = allocatedTaxAmounts.find((a) => a.costCenterId === costCenterId);
  const allocatedTaxAmount = allocatedTax?.amount ?? 0;

  // 9. AllocationGroupItem 作成 + グループ合計再計算（P2: トランザクションで包括）
  await prisma.$transaction(async (tx) => {
    let item;
    try {
      item = await tx.allocationGroupItem.create({
        data: {
          transactionId,
          costCenterId,
          groupType,
          allocatedAmount: allocated.amount,
          allocatedTaxAmount,
          invoiceGroupId: groupType === "invoice" ? groupId : null,
          paymentGroupId: groupType === "payment" ? groupId : null,
          createdBy: staffId,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new Error("このコストセンター分は既に別の請求・支払に追加されています");
      }
      throw e;
    }

    await recordChangeLog(
      {
        tableName: "AllocationGroupItem",
        recordId: item.id,
        changeType: "create",
        newData: {
          transactionId,
          costCenterId,
          groupType,
          ...(groupType === "invoice" ? { invoiceGroupId: groupId } : { paymentGroupId: groupId }),
        },
      },
      staffId,
      tx
    );

    // グループ合計の再計算（同一トランザクション内）
    await recalcGroupTotalsWithAllocations(groupType, groupId, tx);
  });

  revalidatePath("/stp/finance/invoices");
  revalidatePath("/stp/finance/payment-groups");
  revalidatePath("/accounting/transactions");

  return ok({ warnings });
  } catch (e) {
    if (e instanceof FinanceForbiddenError) return err("この操作を行う権限がありません");
    if (e instanceof FinanceRecordNotFoundError) return err("対象が見つかりません");
    console.error("[addAllocationItemToGroup] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ===== 按分アイテムをグループから削除 =====

export async function removeAllocationItemFromGroup(
  allocationGroupItemId: number
): Promise<ActionResult> {
  try {
  const item = await prisma.allocationGroupItem.findUnique({
    where: { id: allocationGroupItemId },
  });
  if (!item) {
    return err("按分明細が見つかりません");
  }

  // per-record 認可: 取引 + グループ両方へのアクセス権を確認
  await requireFinanceTransactionAccess(item.transactionId, "edit");
  if (item.invoiceGroupId) {
    await requireFinanceInvoiceGroupAccess(item.invoiceGroupId, "edit");
  }
  if (item.paymentGroupId) {
    await requireFinancePaymentGroupAccess(item.paymentGroupId, "edit");
  }

  // グループのステータス確認
  if (item.groupType === "invoice" && item.invoiceGroupId) {
    const group = await prisma.invoiceGroup.findFirst({
      where: { id: item.invoiceGroupId, deletedAt: null },
    });
    if (group && !["draft", "pdf_created"].includes(group.status)) {
      return err(`ステータス「${group.status}」の請求管理レコードからは削除できません`);
    }
  } else if (item.groupType === "payment" && item.paymentGroupId) {
    const group = await prisma.paymentGroup.findFirst({
      where: { id: item.paymentGroupId, deletedAt: null },
    });
    if (group && !["before_request", "rejected"].includes(group.status)) {
      return err(`ステータス「${group.status}」の支払管理レコードからは削除できません`);
    }
  }

  // P2: 削除 + グループ合計再計算をトランザクションで包括
  const groupId = item.groupType === "invoice" ? item.invoiceGroupId : item.paymentGroupId;
  const validGroupType = groupTypeSchema.parse(item.groupType);
  const session = await getSession();

  await prisma.$transaction(async (tx) => {
    await recordChangeLog(
      {
        tableName: "AllocationGroupItem",
        recordId: item.id,
        changeType: "delete",
        oldData: { transactionId: item.transactionId, costCenterId: item.costCenterId },
      },
      session.id,
      tx
    );

    await tx.allocationGroupItem.delete({
      where: { id: allocationGroupItemId },
    });

    if (groupId) {
      await recalcGroupTotalsWithAllocations(validGroupType, groupId, tx);
    }
  });

  revalidatePath("/stp/finance/invoices");
  revalidatePath("/stp/finance/payment-groups");
  revalidatePath("/accounting/transactions");
  return ok();
  } catch (e) {
    if (e instanceof FinanceForbiddenError) return err("この操作を行う権限がありません");
    if (e instanceof FinanceRecordNotFoundError) return err("対象が見つかりません");
    console.error("[removeAllocationItemFromGroup] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ===== 按分取引のグループ所属状況を取得 =====

export async function getAllocationGroupStatus(
  transactionId: number
): Promise<ActionResult<AllocationGroupStatus | null>> {
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
      allocationGroupItems: {
        include: {
          costCenter: { select: { id: true, name: true } },
          invoiceGroup: {
            select: { id: true, status: true, invoiceNumber: true },
          },
          paymentGroup: {
            select: { id: true, status: true, targetMonth: true },
          },
        },
      },
    },
  });

  if (!transaction) {
    return err("取引が見つかりません");
  }

  if (!transaction.allocationTemplateId || !transaction.allocationTemplate) {
    return ok(null);
  }

  const amountIncludingTax = transaction.amount + transaction.taxAmount;
  const templateLines = transaction.allocationTemplate.lines.map((l) => ({
    costCenterId: l.costCenterId,
    allocationRate: l.allocationRate,
  }));

  // 按分金額計算（端数寄せ付き）
  const allocatedAmounts = await calculateAllocatedAmounts(
    amountIncludingTax,
    templateLines
  );

  // P1-2: 税額按分も端数寄せ付きで計算
  const allocatedTaxAmounts = await calculateAllocatedAmounts(
    transaction.taxAmount,
    templateLines
  );

  // AllocationGroupItem のマップ
  const itemMap = new Map(
    transaction.allocationGroupItems.map((item) => [item.costCenterId, item])
  );

  const confirmedLines = transaction.allocationTemplate.lines.filter(
    (l) => l.costCenterId !== null
  );

  const items = confirmedLines.map((line) => {
    const allocated = allocatedAmounts.find((a) => a.costCenterId === line.costCenterId);
    const groupItem = itemMap.get(line.costCenterId!);
    const rate = Number(line.allocationRate);
    const allocatedTaxAmount = allocatedTaxAmounts.find((a) => a.costCenterId === line.costCenterId)?.amount ?? 0;

    let groupItemResult: AllocationGroupItemResult | null = null;
    if (groupItem) {
      let groupStatus: string | null = null;
      let groupLabel: string | null = null;

      if (groupItem.invoiceGroup) {
        groupStatus = groupItem.invoiceGroup.status;
        groupLabel = groupItem.invoiceGroup.invoiceNumber ?? `請求#${groupItem.invoiceGroup.id}`;
      } else if (groupItem.paymentGroup) {
        groupStatus = groupItem.paymentGroup.status;
        const month = groupItem.paymentGroup.targetMonth;
        groupLabel = month ? `支払 ${month.getUTCFullYear()}/${String(month.getUTCMonth() + 1).padStart(2, "0")}` : "支払（対象月未設定）";
      }

      groupItemResult = {
        id: groupItem.id,
        transactionId: groupItem.transactionId,
        costCenterId: groupItem.costCenterId,
        costCenterName: groupItem.costCenter.name,
        groupType: groupItem.groupType as "invoice" | "payment",
        allocatedAmount: groupItem.allocatedAmount,
        allocatedTaxAmount: groupItem.allocatedTaxAmount,
        invoiceGroupId: groupItem.invoiceGroupId,
        paymentGroupId: groupItem.paymentGroupId,
        groupStatus,
        groupLabel,
      };
    }

    return {
      costCenterId: line.costCenterId!,
      costCenterName: line.costCenter?.name ?? "不明",
      allocationRate: rate,
      allocatedAmount: allocated?.amount ?? 0,
      allocatedTaxAmount,
      isProcessed: !!groupItem,
      groupItem: groupItemResult,
    };
  });

  return ok({
    transactionId,
    transactionType: transaction.type,
    amountIncludingTax,
    ownerCostCenterId: transaction.allocationTemplate.ownerCostCenterId,
    ownerCostCenterName: transaction.allocationTemplate.lines.find(
      (l) => l.costCenterId === transaction.allocationTemplate!.ownerCostCenterId
    )?.costCenter?.name ?? null,
    items,
  });
  } catch (e) {
    console.error("[getAllocationGroupStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ===== 未処理按分一覧（プロジェクトのCostCenter単位） =====

export async function getUnprocessedAllocations(projectId?: number): Promise<{
  transactionId: number;
  transactionType: string;
  counterpartyName: string;
  amountIncludingTax: number;
  costCenterId: number;
  costCenterName: string;
  allocationRate: number;
  allocatedAmount: number;
  ownerCostCenterId: number | null;
  ownerCostCenterName: string | null;
  otherItemsSummary: { costCenterName: string; groupLabel: string | null; isProcessed: boolean }[];
}[]> {
  // 未処理按分一覧はダッシュボード的用途。projectId 指定ありならそのPJ、なければ finance エントリでOK
  if (projectId) {
    await requireFinanceProjectAccess(projectId, "view");
  } else {
    await requireStaffForFinance("view");
  }
  // プロジェクトに紐づくCostCenterのIDを取得
  let targetCostCenterIds: number[] | undefined;
  if (projectId) {
    const costCenters = await prisma.costCenter.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          { projectId },
          { projectAssignments: { some: { projectId } } },
        ],
      },
      select: { id: true },
    });
    targetCostCenterIds = costCenters.map((cc) => cc.id);
    if (targetCostCenterIds.length === 0) return [];
  }

  // 按分テンプレートを持つ confirmed/awaiting_accounting 取引を取得
  const transactions = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      allocationTemplateId: { not: null },
      status: { in: ["confirmed", "awaiting_accounting", "resubmitted"] },
    },
    include: {
      counterparty: { select: { name: true } },
      allocationTemplate: {
        include: {
          lines: {
            include: {
              costCenter: { select: { id: true, name: true } },
            },
          },
        },
      },
      allocationGroupItems: {
        include: {
          costCenter: { select: { id: true, name: true } },
          invoiceGroup: { select: { id: true, invoiceNumber: true } },
          paymentGroup: { select: { id: true, targetMonth: true } },
        },
      },
      allocationConfirmations: true,
    },
  });

  const results: Awaited<ReturnType<typeof getUnprocessedAllocations>> = [];

  for (const tx of transactions) {
    if (!tx.allocationTemplate) continue;

    const amountIncludingTax = tx.amount + tx.taxAmount;
    const allocatedAmounts = await calculateAllocatedAmounts(
      amountIncludingTax,
      tx.allocationTemplate.lines.map((l) => ({
        costCenterId: l.costCenterId,
        allocationRate: l.allocationRate,
      }))
    );

    const existingItemCcIds = new Set(tx.allocationGroupItems.map((i) => i.costCenterId));
    const confirmedCcIds = new Set(tx.allocationConfirmations.map((ac) => ac.costCenterId));

    for (const line of tx.allocationTemplate.lines) {
      if (line.costCenterId === null) continue;

      // プロジェクトフィルタ
      if (targetCostCenterIds && !targetCostCenterIds.includes(line.costCenterId)) continue;

      // 既にグループに追加済みならスキップ
      if (existingItemCcIds.has(line.costCenterId)) continue;

      // 按分確定済みでないならスキップ（まだ確定していないものは対象外）
      if (!confirmedCcIds.has(line.costCenterId)) continue;

      const allocated = allocatedAmounts.find((a) => a.costCenterId === line.costCenterId);

      // 他のCostCenter分の状況
      const otherItemsSummary = tx.allocationTemplate.lines
        .filter((l) => l.costCenterId !== null && l.costCenterId !== line.costCenterId)
        .map((l) => {
          const item = tx.allocationGroupItems.find((i) => i.costCenterId === l.costCenterId);
          let groupLabel: string | null = null;
          if (item?.invoiceGroup) {
            groupLabel = item.invoiceGroup.invoiceNumber ?? `請求#${item.invoiceGroup.id}`;
          } else if (item?.paymentGroup) {
            const m = item.paymentGroup.targetMonth;
            groupLabel = m ? `支払 ${m.getUTCFullYear()}/${String(m.getUTCMonth() + 1).padStart(2, "0")}` : "支払（対象月未設定）";
          }
          return {
            costCenterName: l.costCenter?.name ?? "不明",
            groupLabel,
            isProcessed: !!item,
          };
        });

      results.push({
        transactionId: tx.id,
        transactionType: tx.type,
        counterpartyName: tx.counterparty?.name ?? "不明",
        amountIncludingTax,
        costCenterId: line.costCenterId,
        costCenterName: line.costCenter?.name ?? "不明",
        allocationRate: Number(line.allocationRate),
        allocatedAmount: allocated?.amount ?? 0,
        ownerCostCenterId: tx.allocationTemplate.ownerCostCenterId,
        ownerCostCenterName: tx.allocationTemplate.lines.find(
          (l) => l.costCenterId === tx.allocationTemplate!.ownerCostCenterId
        )?.costCenter?.name ?? null,
        otherItemsSummary,
      });
    }
  }

  return results;
}

// ===== 未処理按分数のカウント（プロジェクト単位） =====

export async function getUnprocessedAllocationCount(projectId?: number): Promise<number> {
  const items = await getUnprocessedAllocations(projectId);
  return items.length;
}

// ===== グループ合計の再計算（AllocationGroupItem込み） =====

async function recalcGroupTotalsWithAllocations(
  groupType: GroupType,
  groupId: number,
  db: TxClient | typeof prisma = prisma
) {
  if (groupType === "invoice") {
    const group = await db.invoiceGroup.findUnique({
      where: { id: groupId },
      include: {
        transactions: {
          where: { deletedAt: null },
          select: { amount: true, taxAmount: true, taxRate: true, taxType: true },
        },
        allocationItems: {
          select: { allocatedAmount: true, allocatedTaxAmount: true },
        },
      },
    });

    if (!group) return;

    // 直接取引の合計
    let directSubtotal = 0;
    let directTax = 0;
    for (const tx of group.transactions) {
      if (tx.taxType === "tax_included") {
        directSubtotal += tx.amount - tx.taxAmount;
        directTax += tx.taxAmount;
      } else {
        directSubtotal += tx.amount;
        directTax += tx.taxAmount;
      }
    }

    // AllocationGroupItem の合計
    let allocSubtotal = 0;
    let allocTax = 0;
    for (const item of group.allocationItems) {
      allocSubtotal += item.allocatedAmount - item.allocatedTaxAmount;
      allocTax += item.allocatedTaxAmount;
    }

    const subtotal = directSubtotal + allocSubtotal;
    const taxAmount = directTax + allocTax;
    const totalAmount = subtotal + taxAmount;

    await db.invoiceGroup.update({
      where: { id: groupId },
      data: { subtotal, taxAmount, totalAmount },
    });

  } else {
    const group = await db.paymentGroup.findUnique({
      where: { id: groupId },
      include: {
        transactions: {
          where: { deletedAt: null },
          select: { amount: true, taxAmount: true, taxType: true },
        },
        allocationItems: {
          select: { allocatedAmount: true, allocatedTaxAmount: true },
        },
      },
    });

    if (!group) return;

    let directTotal = 0;
    let directTax = 0;
    for (const tx of group.transactions) {
      if (tx.taxType === "tax_included") {
        directTotal += tx.amount;
        directTax += tx.taxAmount;
      } else {
        directTotal += tx.amount + tx.taxAmount;
        directTax += tx.taxAmount;
      }
    }

    let allocTotal = 0;
    let allocTax = 0;
    for (const item of group.allocationItems) {
      allocTotal += item.allocatedAmount;
      allocTax += item.allocatedTaxAmount;
    }

    await db.paymentGroup.update({
      where: { id: groupId },
      data: {
        totalAmount: directTotal + allocTotal,
        taxAmount: directTax + allocTax,
      },
    });
  }
}

// ===== グループ内の按分取引警告取得（詳細モーダル用） =====

export type AllocationWarning = {
  transactionId: number;
  counterpartyName: string;
  expenseCategoryName: string;
  amountIncludingTax: number;
  unprocessedCostCenters: {
    costCenterId: number;
    costCenterName: string;
    allocationRate: number;
    allocatedAmount: number;
  }[];
  processedCostCenters: {
    costCenterId: number;
    costCenterName: string;
    allocationRate: number;
    groupLabel: string | null;
  }[];
  allConfirmationsComplete: boolean;
};

export type GroupAllocationWarningsResult =
  | { ok: true; data: AllocationWarning[] }
  | { ok: false; reason: "not_found" | "forbidden" | "internal"; message: string };

/**
 * グループ内の按分取引警告を取得する（client から直呼び、§4.3.3(d) Result<T> 規約）。
 *
 * 戻り値型が Result<T> のため、呼び出し側は result.ok で分岐する。
 * 旧 `Promise<AllocationWarning[]>` から破壊的変更だが、呼び出し元は STP の 2 モーダルのみ。
 */
export async function getGroupAllocationWarnings(
  groupType: "invoice" | "payment",
  groupId: number
): Promise<GroupAllocationWarningsResult> {
  try {
  // per-record 認可
  if (groupType === "invoice") {
    await requireFinanceInvoiceGroupAccess(groupId, "view");
  } else {
    await requireFinancePaymentGroupAccess(groupId, "view");
  }
  // グループ内の直接取引（按分テンプレート付き）を取得
  const directTransactions = groupType === "invoice"
    ? await prisma.transaction.findMany({
        where: { invoiceGroupId: groupId, deletedAt: null, allocationTemplateId: { not: null } },
        include: {
          counterparty: { select: { name: true } },
          expenseCategory: { select: { name: true } },
          allocationTemplate: {
            include: {
              lines: { include: { costCenter: { select: { id: true, name: true } } } },
            },
          },
          allocationGroupItems: {
            include: {
              costCenter: { select: { id: true, name: true } },
              invoiceGroup: { select: { invoiceNumber: true } },
              paymentGroup: { select: { targetMonth: true } },
            },
          },
          allocationConfirmations: true,
        },
      })
    : await prisma.transaction.findMany({
        where: { paymentGroupId: groupId, deletedAt: null, allocationTemplateId: { not: null } },
        include: {
          counterparty: { select: { name: true } },
          expenseCategory: { select: { name: true } },
          allocationTemplate: {
            include: {
              lines: { include: { costCenter: { select: { id: true, name: true } } } },
            },
          },
          allocationGroupItems: {
            include: {
              costCenter: { select: { id: true, name: true } },
              invoiceGroup: { select: { invoiceNumber: true } },
              paymentGroup: { select: { targetMonth: true } },
            },
          },
          allocationConfirmations: true,
        },
      });

  // AllocationGroupItem経由でこのグループに所属する取引も取得
  const allocationItems = await prisma.allocationGroupItem.findMany({
    where: groupType === "invoice"
      ? { invoiceGroupId: groupId }
      : { paymentGroupId: groupId },
    select: { transactionId: true },
  });

  const allocationTransactionIds = allocationItems
    .map((i) => i.transactionId)
    .filter((id) => !directTransactions.some((t) => t.id === id));

  let allocationTransactions: typeof directTransactions = [];
  if (allocationTransactionIds.length > 0) {
    allocationTransactions = await prisma.transaction.findMany({
      where: { id: { in: allocationTransactionIds }, deletedAt: null },
      include: {
        counterparty: { select: { name: true } },
        expenseCategory: { select: { name: true } },
        allocationTemplate: {
          include: {
            lines: { include: { costCenter: { select: { id: true, name: true } } } },
          },
        },
        allocationGroupItems: {
          include: {
            costCenter: { select: { id: true, name: true } },
            invoiceGroup: { select: { invoiceNumber: true } },
            paymentGroup: { select: { targetMonth: true } },
          },
        },
        allocationConfirmations: true,
      },
    });
  }

  const allTransactions = [...directTransactions, ...allocationTransactions];
  const warnings: AllocationWarning[] = [];

  for (const tx of allTransactions) {
    if (!tx.allocationTemplate) continue;

    const confirmedCcIds = new Set(
      tx.allocationConfirmations.map((ac) => ac.costCenterId)
    );
    const existingItems = tx.allocationGroupItems.filter(
      (i) => i.groupType === groupType
    );
    const processedCcIds = new Set(existingItems.map((i) => i.costCenterId));

    const amountIncludingTax = tx.amount + tx.taxAmount;
    const unprocessedCostCenters: AllocationWarning["unprocessedCostCenters"] = [];
    const processedCostCenters: AllocationWarning["processedCostCenters"] = [];

    const requiredCcIds = tx.allocationTemplate.lines
      .filter((l) => l.costCenterId !== null)
      .map((l) => l.costCenterId!);

    const allConfirmationsComplete = requiredCcIds.every((ccId) =>
      confirmedCcIds.has(ccId)
    );

    for (const line of tx.allocationTemplate.lines) {
      if (line.costCenterId === null) continue;
      const rate = Number(line.allocationRate);
      const allocatedAmount = Math.floor((amountIncludingTax * rate) / 100);

      if (processedCcIds.has(line.costCenterId)) {
        const item = existingItems.find((i) => i.costCenterId === line.costCenterId);
        let groupLabel: string | null = null;
        if (item?.invoiceGroup) {
          groupLabel = item.invoiceGroup.invoiceNumber ?? null;
        } else if (item?.paymentGroup) {
          const m = item.paymentGroup.targetMonth;
          groupLabel = m ? `支払 ${m.getUTCFullYear()}/${String(m.getUTCMonth() + 1).padStart(2, "0")}` : "支払（対象月未設定）";
        }
        processedCostCenters.push({
          costCenterId: line.costCenterId,
          costCenterName: line.costCenter?.name ?? "不明",
          allocationRate: rate,
          groupLabel,
        });
      } else {
        unprocessedCostCenters.push({
          costCenterId: line.costCenterId,
          costCenterName: line.costCenter?.name ?? "不明",
          allocationRate: rate,
          allocatedAmount,
        });
      }
    }

    // 未処理のCCがある場合のみ警告
    if (unprocessedCostCenters.length > 0) {
      warnings.push({
        transactionId: tx.id,
        counterpartyName: tx.counterparty?.name ?? "不明",
        expenseCategoryName: tx.expenseCategory?.name ?? "（未設定）",
        amountIncludingTax,
        unprocessedCostCenters,
        processedCostCenters,
        allConfirmationsComplete,
      });
    }
  }

  return { ok: true, data: warnings };
  } catch (e) {
    if (e instanceof FinanceRecordNotFoundError) {
      return { ok: false, reason: "not_found", message: "対象のグループが見つかりません" };
    }
    if (e instanceof FinanceForbiddenError) {
      return { ok: false, reason: "forbidden", message: "このグループにアクセスする権限がありません" };
    }
    console.error("[getGroupAllocationWarnings] error:", e);
    return { ok: false, reason: "internal", message: e instanceof Error ? e.message : "予期しないエラー" };
  }
}

