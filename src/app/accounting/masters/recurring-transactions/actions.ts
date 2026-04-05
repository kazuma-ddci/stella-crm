"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toBoolean } from "@/lib/utils";

const REVALIDATE_PATH = "/accounting/masters/recurring-transactions";

const VALID_TYPES = ["revenue", "expense"] as const;
const VALID_AMOUNT_TYPES = ["fixed", "variable"] as const;
const VALID_FREQUENCIES = ["once", "monthly", "yearly", "weekly"] as const;

// ===== 定期取引作成 =====
export async function createRecurringTransaction(
  data: Record<string, unknown>
) {
  const session = await getSession();
  const staffId = session.id;

  const type = data.type as string;
  const name = (data.name as string)?.trim();
  const counterpartyId = data.counterpartyId
    ? Number(data.counterpartyId)
    : null;
  const expenseCategoryId = data.expenseCategoryId
    ? Number(data.expenseCategoryId)
    : null;
  const costCenterId = data.costCenterId ? Number(data.costCenterId) : null;
  const allocationTemplateId = data.allocationTemplateId
    ? Number(data.allocationTemplateId)
    : null;
  const paymentMethodId = data.paymentMethodId
    ? Number(data.paymentMethodId)
    : null;
  const projectId = data.projectId ? Number(data.projectId) : null;
  const amount = data.amount ? Number(data.amount) : null;
  const taxAmount = data.taxAmount ? Number(data.taxAmount) : null;
  const taxRate = data.taxRate !== undefined ? Number(data.taxRate) : 10;
  const amountType = (data.amountType as string) || "fixed";
  const frequency = data.frequency as string;
  const executionDay = data.executionDay ? Number(data.executionDay) : null;
  const intervalCount = data.intervalCount ? Number(data.intervalCount) : 1;
  const executeOnLastDay = toBoolean(data.executeOnLastDay);
  const approverStaffId = data.approverStaffId ? Number(data.approverStaffId) : null;
  const startDate = data.startDate
    ? new Date(data.startDate as string)
    : null;
  const endDate = data.endDate ? new Date(data.endDate as string) : null;
  const isActive = data.isActive !== false && data.isActive !== "false";
  const note = data.note ? (data.note as string).trim() : null;

  // === バリデーション ===

  if (!type || !(VALID_TYPES as readonly string[]).includes(type)) {
    throw new Error("種別（売上/経費）は必須です");
  }

  if (!name) {
    throw new Error("名称は必須です");
  }

  if (!counterpartyId) {
    throw new Error("取引先は必須です");
  }

  if (!expenseCategoryId) {
    throw new Error("費目は必須です");
  }

  if (!(VALID_AMOUNT_TYPES as readonly string[]).includes(amountType)) {
    throw new Error("無効な金額タイプです");
  }

  if (
    !frequency ||
    !(VALID_FREQUENCIES as readonly string[]).includes(frequency)
  ) {
    throw new Error("頻度は必須です");
  }

  if (!startDate) {
    throw new Error("開始日は必須です");
  }

  if (intervalCount < 1 || !Number.isInteger(intervalCount)) {
    throw new Error("繰り返し間隔は1以上の整数で指定してください");
  }

  // 固定金額の場合、金額は必須
  if (amountType === "fixed" && (amount === null || amount === 0)) {
    throw new Error("固定金額の場合、金額は必須です");
  }

  // executionDay バリデーション
  if (executionDay !== null) {
    if (frequency === "monthly" || frequency === "yearly") {
      if (executionDay < 1 || executionDay > 31) {
        throw new Error("実行日は1〜31の範囲で指定してください");
      }
    }
    if (frequency === "weekly") {
      if (executionDay < 0 || executionDay > 6) {
        throw new Error("曜日は0（日）〜6（土）の範囲で指定してください");
      }
    }
  }

  // プロジェクトと按分テンプレートの排他チェック
  if (costCenterId && allocationTemplateId) {
    throw new Error(
      "プロジェクト（按分なし）と按分テンプレートは同時に設定できません。どちらか一方を選択してください"
    );
  }

  // === FK存在チェック ===

  const counterparty = await prisma.counterparty.findFirst({
    where: { id: counterpartyId, deletedAt: null },
    select: { id: true },
  });
  if (!counterparty) throw new Error("指定した取引先が見つかりません");

  const expenseCategory = await prisma.expenseCategory.findFirst({
    where: { id: expenseCategoryId, deletedAt: null },
    select: { id: true },
  });
  if (!expenseCategory) throw new Error("指定した費目が見つかりません");

  if (costCenterId) {
    const cc = await prisma.costCenter.findFirst({
      where: { id: costCenterId, deletedAt: null },
      select: { id: true },
    });
    if (!cc) throw new Error("指定したプロジェクトが見つかりません");
  }

  if (allocationTemplateId) {
    const at = await prisma.allocationTemplate.findFirst({
      where: { id: allocationTemplateId, deletedAt: null },
      select: { id: true },
    });
    if (!at) throw new Error("指定した按分テンプレートが見つかりません");
  }

  if (paymentMethodId) {
    const pm = await prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, deletedAt: null },
      select: { id: true },
    });
    if (!pm) throw new Error("指定した決済手段が見つかりません");
  }

  if (projectId) {
    const pj = await prisma.masterProject.findFirst({
      where: { id: projectId },
      select: { id: true },
    });
    if (!pj) throw new Error("指定したプロジェクトが見つかりません");
  }

  await prisma.recurringTransaction.create({
    data: {
      type,
      name,
      counterpartyId,
      expenseCategoryId,
      costCenterId: costCenterId || null,
      allocationTemplateId: allocationTemplateId || null,
      paymentMethodId: paymentMethodId || null,
      projectId: projectId || null,
      approverStaffId: approverStaffId || null,
      amount: amountType === "fixed" ? amount : null,
      taxAmount: amountType === "fixed" ? taxAmount : null,
      taxRate,
      amountType,
      frequency,
      intervalCount,
      executeOnLastDay,
      executionDay,
      startDate,
      endDate: endDate || null,
      isActive,
      note: note || null,
      createdBy: staffId,
    },
  });

  revalidatePath(REVALIDATE_PATH);
}

// ===== 定期取引更新 =====
export async function updateRecurringTransaction(
  id: number,
  data: Record<string, unknown>
) {
  const session = await getSession();
  const staffId = session.id;

  const existing = await prisma.recurringTransaction.findUnique({
    where: { id },
    select: { id: true, deletedAt: true, frequency: true, costCenterId: true, allocationTemplateId: true },
  });
  if (!existing || existing.deletedAt) {
    throw new Error("定期取引が見つかりません");
  }

  const updateData: Record<string, unknown> = {};

  if ("type" in data) {
    const type = data.type as string;
    if (!(VALID_TYPES as readonly string[]).includes(type)) {
      throw new Error("無効な種別です");
    }
    updateData.type = type;
  }

  if ("name" in data) {
    const name = (data.name as string)?.trim();
    if (!name) throw new Error("名称は必須です");
    updateData.name = name;
  }

  if ("counterpartyId" in data) {
    const counterpartyId = data.counterpartyId
      ? Number(data.counterpartyId)
      : null;
    if (!counterpartyId) throw new Error("取引先は必須です");
    const c = await prisma.counterparty.findFirst({
      where: { id: counterpartyId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new Error("指定した取引先が見つかりません");
    updateData.counterpartyId = counterpartyId;
  }

  if ("expenseCategoryId" in data) {
    const expenseCategoryId = data.expenseCategoryId
      ? Number(data.expenseCategoryId)
      : null;
    if (!expenseCategoryId) throw new Error("費目は必須です");
    const ec = await prisma.expenseCategory.findFirst({
      where: { id: expenseCategoryId, deletedAt: null },
      select: { id: true },
    });
    if (!ec) throw new Error("指定した費目が見つかりません");
    updateData.expenseCategoryId = expenseCategoryId;
  }

  if ("amountType" in data) {
    const amountType = data.amountType as string;
    if (!(VALID_AMOUNT_TYPES as readonly string[]).includes(amountType)) {
      throw new Error("無効な金額タイプです");
    }
    updateData.amountType = amountType;
    if (amountType === "variable") {
      updateData.amount = null;
      updateData.taxAmount = null;
    }
  }

  if ("amount" in data) {
    updateData.amount = data.amount ? Number(data.amount) : null;
  }

  if ("taxAmount" in data) {
    updateData.taxAmount = data.taxAmount ? Number(data.taxAmount) : null;
  }

  if ("taxRate" in data) {
    updateData.taxRate = Number(data.taxRate) || 10;
  }

  if ("frequency" in data) {
    const frequency = data.frequency as string;
    if (!(VALID_FREQUENCIES as readonly string[]).includes(frequency)) {
      throw new Error("無効な頻度です");
    }
    updateData.frequency = frequency;
  }

  if ("executionDay" in data) {
    const executionDay = data.executionDay ? Number(data.executionDay) : null;
    const effectiveFrequency =
      (updateData.frequency as string) || existing.frequency;

    if (executionDay !== null) {
      if (
        (effectiveFrequency === "monthly" ||
          effectiveFrequency === "yearly") &&
        (executionDay < 1 || executionDay > 31)
      ) {
        throw new Error("実行日は1〜31の範囲で指定してください");
      }
      if (
        effectiveFrequency === "weekly" &&
        (executionDay < 0 || executionDay > 6)
      ) {
        throw new Error("曜日は0（日）〜6（土）の範囲で指定してください");
      }
    }
    updateData.executionDay = executionDay;
  }

  if ("startDate" in data) {
    if (!data.startDate) throw new Error("開始日は必須です");
    updateData.startDate = new Date(data.startDate as string);
  }

  if ("endDate" in data) {
    updateData.endDate = data.endDate
      ? new Date(data.endDate as string)
      : null;
  }

  if ("costCenterId" in data) {
    const costCenterId = data.costCenterId
      ? Number(data.costCenterId)
      : null;
    if (costCenterId) {
      const cc = await prisma.costCenter.findFirst({
        where: { id: costCenterId, deletedAt: null },
        select: { id: true },
      });
      if (!cc)
        throw new Error("指定したプロジェクト（按分先）が見つかりません");
    }
    updateData.costCenterId = costCenterId;
  }

  if ("allocationTemplateId" in data) {
    const allocationTemplateId = data.allocationTemplateId
      ? Number(data.allocationTemplateId)
      : null;
    if (allocationTemplateId) {
      const at = await prisma.allocationTemplate.findFirst({
        where: { id: allocationTemplateId, deletedAt: null },
        select: { id: true },
      });
      if (!at) throw new Error("指定した按分テンプレートが見つかりません");
    }
    updateData.allocationTemplateId = allocationTemplateId;
  }

  if ("paymentMethodId" in data) {
    const paymentMethodId = data.paymentMethodId
      ? Number(data.paymentMethodId)
      : null;
    if (paymentMethodId) {
      const pm = await prisma.paymentMethod.findFirst({
        where: { id: paymentMethodId, deletedAt: null },
        select: { id: true },
      });
      if (!pm) throw new Error("指定した決済手段が見つかりません");
    }
    updateData.paymentMethodId = paymentMethodId;
  }

  if ("projectId" in data) {
    const projectId = data.projectId ? Number(data.projectId) : null;
    if (projectId) {
      const pj = await prisma.masterProject.findFirst({
        where: { id: projectId },
        select: { id: true },
      });
      if (!pj) throw new Error("指定したプロジェクトが見つかりません");
    }
    updateData.projectId = projectId;
  }

  if ("intervalCount" in data) {
    const intervalCount = data.intervalCount ? Number(data.intervalCount) : 1;
    if (intervalCount < 1 || !Number.isInteger(intervalCount)) {
      throw new Error("繰り返し間隔は1以上の整数で指定してください");
    }
    updateData.intervalCount = intervalCount;
  }

  if ("executeOnLastDay" in data) {
    updateData.executeOnLastDay = toBoolean(data.executeOnLastDay);
  }

  if ("approverStaffId" in data) {
    const approverStaffId = data.approverStaffId ? Number(data.approverStaffId) : null;
    if (approverStaffId) {
      const s = await prisma.masterStaff.findFirst({
        where: { id: approverStaffId, isActive: true },
        select: { id: true },
      });
      if (!s) throw new Error("指定した承認者が見つかりません");
    }
    updateData.approverStaffId = approverStaffId;
  }

  if ("isActive" in data) {
    updateData.isActive = toBoolean(data.isActive);
  }

  if ("note" in data) {
    updateData.note = data.note ? (data.note as string).trim() : null;
  }

  // プロジェクトと按分テンプレートの排他チェック
  const effectiveCostCenterId = "costCenterId" in updateData ? updateData.costCenterId : existing.costCenterId;
  const effectiveAllocId = "allocationTemplateId" in updateData ? updateData.allocationTemplateId : existing.allocationTemplateId;
  if (effectiveCostCenterId && effectiveAllocId) {
    throw new Error(
      "プロジェクト（按分なし）と按分テンプレートは同時に設定できません。どちらか一方を選択してください"
    );
  }

  updateData.updatedBy = staffId;

  await prisma.recurringTransaction.update({
    where: { id },
    data: updateData,
  });

  revalidatePath(REVALIDATE_PATH);
}

// ===== 定期取引削除（論理削除） =====
export async function deleteRecurringTransaction(id: number) {
  const session = await getSession();
  const staffId = session.id;

  // 存在チェック・論理削除済みチェック
  const existing = await prisma.recurringTransaction.findUnique({
    where: { id },
    select: { id: true, deletedAt: true },
  });
  if (!existing || existing.deletedAt) {
    throw new Error("定期取引が見つかりません");
  }

  // 使用中チェック: 生成済み取引があるか
  const txCount = await prisma.transaction.count({
    where: { recurringTransactionId: id, deletedAt: null },
  });

  if (txCount > 0) {
    throw new Error(
      `この定期取引から生成された取引が${txCount}件あります。削除する代わりに「有効」フラグをオフにしてください。`
    );
  }

  await prisma.recurringTransaction.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      updatedBy: staffId,
    },
  });

  revalidatePath(REVALIDATE_PATH);
}
