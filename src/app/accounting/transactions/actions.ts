"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// ============================================
// 型定義
// ============================================

export type TransactionFormData = {
  counterparties: {
    id: number;
    name: string;
    counterpartyType: string;
  }[];
  expenseCategories: {
    id: number;
    name: string;
    type: string;
  }[];
  costCenters: {
    id: number;
    name: string;
    projectId: number | null;
  }[];
  allocationTemplates: {
    id: number;
    name: string;
    lines: {
      id: number;
      costCenterId: number | null;
      allocationRate: unknown; // Decimal
      label: string | null;
      costCenter: { id: number; name: string } | null;
    }[];
  }[];
  paymentMethods: {
    id: number;
    name: string;
    methodType: string;
  }[];
  contracts: {
    id: number;
    title: string;
    companyId: number;
    company: { id: number; name: string };
    endDate: Date | null;
  }[];
};

// ============================================
// バリデーション
// ============================================

const VALID_TYPES = ["revenue", "expense"] as const;
const VALID_TAX_TYPES = ["tax_included", "tax_excluded"] as const;

function validateTransactionData(data: Record<string, unknown>) {
  // type
  const type = data.type as string;
  if (!type || !(VALID_TYPES as readonly string[]).includes(type)) {
    throw new Error("種別（revenue/expense）は必須です");
  }

  // taxType
  const taxType = (data.taxType as string) || "tax_excluded";
  if (!(VALID_TAX_TYPES as readonly string[]).includes(taxType)) {
    throw new Error("税区分（tax_included/tax_excluded）が不正です");
  }

  // counterpartyId
  const counterpartyId = Number(data.counterpartyId);
  if (!data.counterpartyId || isNaN(counterpartyId)) {
    throw new Error("取引先は必須です");
  }

  // expenseCategoryId
  const expenseCategoryId = Number(data.expenseCategoryId);
  if (!data.expenseCategoryId || isNaN(expenseCategoryId)) {
    throw new Error("費目は必須です");
  }

  // amount
  const amount = Number(data.amount);
  if (data.amount === undefined || data.amount === null || isNaN(amount) || amount < 0 || !Number.isInteger(amount)) {
    throw new Error("金額は0以上の整数で入力してください");
  }

  // taxRate
  const taxRate = Number(data.taxRate);
  if (data.taxRate === undefined || data.taxRate === null || isNaN(taxRate) || !Number.isInteger(taxRate)) {
    throw new Error("税率は整数で入力してください");
  }

  // taxAmount
  const taxAmount = Number(data.taxAmount);
  if (data.taxAmount === undefined || data.taxAmount === null || isNaN(taxAmount) || !Number.isInteger(taxAmount)) {
    throw new Error("消費税額は整数で入力してください");
  }

  // 消費税額の妥当性チェック（手動修正を許容しつつ、大幅な乖離を防ぐ）
  if (amount > 0 && taxRate > 0) {
    let expectedTax: number;
    if (taxType === "tax_included") {
      expectedTax = Math.floor(amount - amount / (1 + taxRate / 100));
    } else {
      expectedTax = Math.floor(amount * taxRate / 100);
    }
    // 手動修正を許容: 自動計算値との差が20%以上ある場合は警告
    if (expectedTax > 0 && Math.abs(taxAmount - expectedTax) / expectedTax > 0.2) {
      // 手動修正は許容するためエラーにはしない（ログ出力で追跡可能）
      console.warn(
        `消費税額が自動計算値と乖離しています: 入力=${taxAmount}, 期待=${expectedTax}, taxType=${taxType}`
      );
    }
  }

  // periodFrom, periodTo
  if (!data.periodFrom) {
    throw new Error("発生期間（開始）は必須です");
  }
  if (!data.periodTo) {
    throw new Error("発生期間（終了）は必須です");
  }
  const periodFrom = new Date(data.periodFrom as string);
  const periodTo = new Date(data.periodTo as string);
  if (isNaN(periodFrom.getTime())) {
    throw new Error("発生期間（開始）が無効な日付です");
  }
  if (isNaN(periodTo.getTime())) {
    throw new Error("発生期間（終了）が無効な日付です");
  }
  if (periodFrom > periodTo) {
    throw new Error("発生期間の開始日は終了日以前にしてください");
  }

  // allocationTemplateId と costCenterId の排他チェック
  const allocationTemplateId = data.allocationTemplateId
    ? Number(data.allocationTemplateId)
    : null;
  const costCenterId = data.costCenterId
    ? Number(data.costCenterId)
    : null;

  if (allocationTemplateId && costCenterId) {
    throw new Error(
      "按分テンプレートと按分先は同時に指定できません"
    );
  }
  if (!allocationTemplateId && !costCenterId) {
    throw new Error(
      "按分テンプレートまたは按分先のいずれかを指定してください"
    );
  }

  return {
    type,
    taxType,
    counterpartyId,
    expenseCategoryId,
    amount,
    taxAmount,
    taxRate,
    periodFrom,
    periodTo,
    allocationTemplateId,
    costCenterId,
  };
}

// ============================================
// 1. createTransaction
// ============================================

export async function createTransaction(data: Record<string, unknown>) {
  const session = await getSession();
  const staffId = session.id;

  const validated = validateTransactionData(data);

  const contractId = data.contractId ? Number(data.contractId) : null;
  const projectId = data.projectId ? Number(data.projectId) : null;
  const paymentMethodId = data.paymentMethodId
    ? Number(data.paymentMethodId)
    : null;
  const paymentDueDate = data.paymentDueDate
    ? new Date(data.paymentDueDate as string)
    : null;
  const note = data.note ? (data.note as string).trim() || null : null;

  // 源泉徴収
  const isWithholdingTarget =
    data.isWithholdingTarget === true || data.isWithholdingTarget === "true";
  const withholdingTaxRate = data.withholdingTaxRate
    ? Number(data.withholdingTaxRate)
    : null;
  const withholdingTaxAmount = data.withholdingTaxAmount
    ? Number(data.withholdingTaxAmount)
    : null;
  const netPaymentAmount = data.netPaymentAmount
    ? Number(data.netPaymentAmount)
    : null;

  // 証憑
  const attachments = (data.attachments as Array<{
    filePath: string;
    fileName: string;
    fileSize?: number;
    mimeType?: string;
    attachmentType?: string;
  }>) || [];

  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        type: validated.type,
        counterpartyId: validated.counterpartyId,
        expenseCategoryId: validated.expenseCategoryId,
        amount: validated.amount,
        taxAmount: validated.taxAmount,
        taxRate: validated.taxRate,
        taxType: validated.taxType,
        periodFrom: validated.periodFrom,
        periodTo: validated.periodTo,
        allocationTemplateId: validated.allocationTemplateId,
        costCenterId: validated.costCenterId,
        contractId,
        projectId,
        paymentMethodId,
        paymentDueDate,
        note,
        sourceType: "manual",
        isWithholdingTarget,
        withholdingTaxRate,
        withholdingTaxAmount,
        netPaymentAmount,
        createdBy: staffId,
      },
    });

    // 証憑作成
    if (attachments.length > 0) {
      await tx.attachment.createMany({
        data: attachments.map((att) => ({
          transactionId: transaction.id,
          filePath: att.filePath,
          fileName: att.fileName,
          fileSize: att.fileSize ?? null,
          mimeType: att.mimeType ?? null,
          attachmentType: att.attachmentType ?? "other",
          uploadedBy: staffId,
        })),
      });
    }

    return transaction;
  });

  revalidatePath("/accounting/transactions");

  return { id: result.id };
}

// ============================================
// 2. updateTransaction
// ============================================

export async function updateTransaction(
  id: number,
  data: Record<string, unknown>
) {
  const session = await getSession();
  const staffId = session.id;

  // 既存レコード取得
  const existing = await prisma.transaction.findFirst({
    where: { id, deletedAt: null },
    include: {
      attachments: { where: { deletedAt: null } },
    },
  });
  if (!existing) {
    throw new Error("取引が見つかりません");
  }

  const validated = validateTransactionData(data);

  const contractId = data.contractId ? Number(data.contractId) : null;
  const projectId = data.projectId ? Number(data.projectId) : null;
  const paymentMethodId = data.paymentMethodId
    ? Number(data.paymentMethodId)
    : null;
  const paymentDueDate = data.paymentDueDate
    ? new Date(data.paymentDueDate as string)
    : null;
  const note = data.note ? (data.note as string).trim() || null : null;

  // 源泉徴収
  const isWithholdingTarget =
    data.isWithholdingTarget === true || data.isWithholdingTarget === "true";
  const withholdingTaxRate = data.withholdingTaxRate
    ? Number(data.withholdingTaxRate)
    : null;
  const withholdingTaxAmount = data.withholdingTaxAmount
    ? Number(data.withholdingTaxAmount)
    : null;
  const netPaymentAmount = data.netPaymentAmount
    ? Number(data.netPaymentAmount)
    : null;

  // 証憑
  const incomingAttachments = (data.attachments as Array<{
    id?: number;
    filePath: string;
    fileName: string;
    fileSize?: number;
    mimeType?: string;
    attachmentType?: string;
  }>) || [];

  await prisma.$transaction(async (tx) => {
    // 取引更新
    await tx.transaction.update({
      where: { id },
      data: {
        type: validated.type,
        counterpartyId: validated.counterpartyId,
        expenseCategoryId: validated.expenseCategoryId,
        amount: validated.amount,
        taxAmount: validated.taxAmount,
        taxRate: validated.taxRate,
        taxType: validated.taxType,
        periodFrom: validated.periodFrom,
        periodTo: validated.periodTo,
        allocationTemplateId: validated.allocationTemplateId,
        costCenterId: validated.costCenterId,
        contractId,
        projectId,
        paymentMethodId,
        paymentDueDate,
        note,
        isWithholdingTarget,
        withholdingTaxRate,
        withholdingTaxAmount,
        netPaymentAmount,
        updatedBy: staffId,
      },
    });

    // 証憑の差分管理
    const incomingIds = new Set(
      incomingAttachments
        .filter((att) => att.id !== undefined)
        .map((att) => att.id as number)
    );

    // 既存で incoming に含まれないものを論理削除
    const toDelete = existing.attachments.filter(
      (att) => !incomingIds.has(att.id)
    );
    if (toDelete.length > 0) {
      await tx.attachment.updateMany({
        where: { id: { in: toDelete.map((att) => att.id) } },
        data: { deletedAt: new Date() },
      });
    }

    // 新規追加（idがないもの）
    const toCreate = incomingAttachments.filter(
      (att) => att.id === undefined
    );
    if (toCreate.length > 0) {
      await tx.attachment.createMany({
        data: toCreate.map((att) => ({
          transactionId: id,
          filePath: att.filePath,
          fileName: att.fileName,
          fileSize: att.fileSize ?? null,
          mimeType: att.mimeType ?? null,
          attachmentType: att.attachmentType ?? "other",
          uploadedBy: staffId,
        })),
      });
    }
  });

  revalidatePath("/accounting/transactions");
}

// ============================================
// 3. getTransactionById
// ============================================

export async function getTransactionById(id: number) {
  const transaction = await prisma.transaction.findFirst({
    where: { id, deletedAt: null },
    include: {
      counterparty: {
        select: { id: true, name: true, counterpartyType: true },
      },
      contract: {
        select: {
          id: true,
          title: true,
          company: { select: { id: true, name: true } },
        },
      },
      allocationTemplate: {
        include: {
          lines: {
            include: {
              costCenter: { select: { id: true, name: true } },
            },
          },
        },
      },
      costCenter: {
        select: { id: true, name: true, projectId: true },
      },
      expenseCategory: {
        select: { id: true, name: true, type: true },
      },
      project: {
        select: { id: true, name: true, code: true },
      },
      paymentMethod: {
        select: { id: true, name: true, methodType: true },
      },
      attachments: {
        where: { deletedAt: null },
      },
    },
  });

  return transaction ?? null;
}

// ============================================
// 4. getTransactionFormData
// ============================================

export async function getTransactionFormData(): Promise<TransactionFormData> {
  const [
    counterparties,
    expenseCategories,
    costCenters,
    allocationTemplates,
    paymentMethods,
    contracts,
  ] = await Promise.all([
    // 取引先
    prisma.counterparty.findMany({
      where: { deletedAt: null, mergedIntoId: null, isActive: true },
      select: { id: true, name: true, counterpartyType: true },
      orderBy: { name: "asc" },
    }),

    // 費目
    prisma.expenseCategory.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, type: true },
      orderBy: { displayOrder: "asc" },
    }),

    // 按分先
    prisma.costCenter.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, projectId: true },
      orderBy: { name: "asc" },
    }),

    // 按分テンプレート
    prisma.allocationTemplate.findMany({
      where: { deletedAt: null, isActive: true },
      include: {
        lines: {
          include: {
            costCenter: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),

    // 決済手段
    prisma.paymentMethod.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, methodType: true },
      orderBy: { name: "asc" },
    }),

    // 契約一覧（取引先との紐づけ用にcompanyIdを保持）
    prisma.masterContract.findMany({
      select: {
        id: true,
        title: true,
        companyId: true,
        company: { select: { id: true, name: true } },
        endDate: true,
      },
      orderBy: { id: "desc" },
      take: 500,
    }),
  ]);

  return {
    counterparties,
    expenseCategories,
    costCenters,
    allocationTemplates: allocationTemplates.map((t) => ({
      id: t.id,
      name: t.name,
      lines: t.lines.map((l) => ({
        id: l.id,
        costCenterId: l.costCenterId,
        allocationRate: l.allocationRate,
        label: l.label,
        costCenter: l.costCenter,
      })),
    })),
    paymentMethods,
    contracts,
  };
}
